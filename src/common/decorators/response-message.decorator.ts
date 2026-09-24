import { SetMetadata } from "@nestjs/common";

export const RESPONSE_MESSAGE_KEY = "response_message";

/**
 * Decorator to set a custom success message for an endpoint.
 * The global ResponseInterceptor reads this to populate the `message` field.
 *
 * @example
 *   @Post()
 *   @ResponseMessage('User created successfully')
 *   create() { ... }
 */
export const ResponseMessage = (message: string) =>
  SetMetadata(RESPONSE_MESSAGE_KEY, message);
