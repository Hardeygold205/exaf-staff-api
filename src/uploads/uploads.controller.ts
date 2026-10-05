import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor, FilesInterceptor } from "@nestjs/platform-express";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { diskStorage } from "multer";
import { Response } from "express";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import {
  CurrentUser,
  AuthUser,
} from "../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { UploadsService } from "./uploads.service";
import {
  ALLOWED_UPLOAD_MIME_TYPES,
  UPLOAD_ENTITY_TYPES,
  uploadMetaSchema,
  UploadMetaInput,
  queryUploadsSchema,
  QueryUploadsInput,
} from "./uploads.schemas";
import { ResponseMessage } from "../common/decorators/response-message.decorator";

const MAX_FILE_SIZE_BYTES =
  Number(process.env.MAX_UPLOAD_SIZE_MB ?? 500) * 1024 * 1024;
const MAX_FILES_PER_UPLOAD = Number(process.env.MAX_FILES_PER_UPLOAD ?? 100);

const multerOptions = {
  storage: diskStorage({
    destination: tmpdir(),
    filename: (
      _req: unknown,
      file: Express.Multer.File,
      cb: (error: Error | null, filename: string) => void,
    ) =>
      cb(null, `${randomUUID()}-${file.originalname.replace(/[\\/]/g, "_")}`),
  }),
  preservePath: true,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (
    _req: unknown,
    file: Express.Multer.File,
    cb: (err: Error | null, accept: boolean) => void,
  ) => {
    if (
      !ALLOWED_UPLOAD_MIME_TYPES.includes(
        file.mimetype as (typeof ALLOWED_UPLOAD_MIME_TYPES)[number],
      )
    ) {
      return cb(
        new BadRequestException(`Unsupported file type: ${file.mimetype}`),
        false,
      );
    }
    cb(null, true);
  },
};

@ApiTags("Uploads")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("uploads")
export class UploadsController {
  constructor(private uploadsService: UploadsService) {}

  @Post()
  @ResponseMessage("Upload created successfully")
  @RequirePermissions("uploads:create")
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: { type: "string", format: "binary" },
        entityType: { type: "string", enum: [...UPLOAD_ENTITY_TYPES] },
        entityId: { type: "string" },
      },
    },
  })
  @UseInterceptors(FileInterceptor("file", multerOptions))
  uploadOne(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File,
    @Body(new ZodValidationPipe(uploadMetaSchema)) meta: UploadMetaInput,
  ) {
    if (!file) throw new BadRequestException("No file provided");
    return this.uploadsService.uploadOne(user, file, meta);
  }

  @Post("multiple")
  @ResponseMessage("Upload created successfully")
  @RequirePermissions("uploads:create")
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        files: { type: "array", items: { type: "string", format: "binary" } },
        entityType: { type: "string", enum: [...UPLOAD_ENTITY_TYPES] },
        entityId: { type: "string" },
      },
    },
  })
  @UseInterceptors(
    FilesInterceptor("files", MAX_FILES_PER_UPLOAD, multerOptions),
  )
  uploadMany(
    @CurrentUser() user: AuthUser,
    @UploadedFiles() files: Express.Multer.File[],
    @Body(new ZodValidationPipe(uploadMetaSchema)) meta: UploadMetaInput,
  ) {
    if (!files?.length) throw new BadRequestException("No files provided");
    return this.uploadsService.uploadMany(user, files, meta);
  }

  @Get("me")
  @ResponseMessage("User uploads retrieved successfully")
  findOwn(@CurrentUser() user: AuthUser) {
    return this.uploadsService.findOwn(user.id);
  }

  @Get()
  @ResponseMessage("Upload fetched successfully")
  @ApiQuery({ name: "entityType", enum: UPLOAD_ENTITY_TYPES, required: false })
  @ApiQuery({ name: "entityId", type: String, required: false })
  @ApiQuery({ name: "page", type: Number, required: false, example: 1 })
  @ApiQuery({ name: "limit", type: Number, required: false, example: 20 })
  findForEntity(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(queryUploadsSchema)) query: QueryUploadsInput,
  ) {
    return this.uploadsService.findForEntity(user, query);
  }

  @Get(":id")
  @ResponseMessage("Upload retrieved successfully")
  findOne(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.uploadsService.findOne(id, user);
  }

  @Get(":id/download")
  @ResponseMessage("Upload download initiated")
  async download(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    const target = await this.uploadsService.getDownloadTarget(id, user);
    if (target.type === "redirect") return res.redirect(target.url);
    return res.download(target.path, target.filename);
  }

  @Delete(":id")
  @ResponseMessage("Upload deleted successfully")
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.uploadsService.remove(id, user);
  }
}
