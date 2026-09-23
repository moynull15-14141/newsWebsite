import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';

/**
 * Last line of defense against leaking implementation details to a client (Phase 2M). Every route
 * already throws deliberate, safe HttpExceptions (BadRequestException, ForbiddenException, etc.) whose
 * own message is meant to be seen — those pass through unchanged. Anything else (a raw
 * PrismaClientKnownRequestError, a TypeError, a database connection failure) could otherwise reach the
 * client with a stack trace, a SQL fragment, or a filesystem path in its message; this filter replaces
 * those with a single generic message and logs the real error, with its stack and the request id for
 * correlation, only server-side.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();
    const requestId = response.getHeader?.('X-Request-Id') || request?.headers?.['x-request-id'];

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      // Nest's own HttpExceptions are already safe (their message is authored by our own code), but
      // a 5xx one — e.g. an explicit InternalServerErrorException somewhere — still gets its full
      // detail logged server-side, same as an unexpected error, since a 5xx here is still a bug worth
      // investigating even though its message happens to already be safe to return.
      if (status >= 500) {
        this.logger.error(`[${requestId}] ${request?.method} ${request?.originalUrl} -> ${status}: ${exception.message}`, exception.stack);
      }
      response.status(status).json(typeof body === 'string' ? { statusCode: status, message: body } : body);
      return;
    }

    const status = HttpStatus.INTERNAL_SERVER_ERROR;
    const err = exception as Error;
    this.logger.error(`[${requestId}] ${request?.method} ${request?.originalUrl} -> 500: ${err?.message}`, err?.stack);
    response.status(status).json({ statusCode: status, message: 'Internal server error' });
  }
}
