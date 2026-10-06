export class AppError extends Error {
  constructor(message, { status = 500, code = 'INTERNAL_ERROR', details } = {}) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Page introuvable') {
    super(message, { status: 404, code: 'NOT_FOUND' });
  }
}

export class ValidationError extends AppError {
  constructor(details, message = 'Certains champs sont à corriger') {
    super(message, { status: 422, code: 'VALIDATION_ERROR', details });
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Accès refusé') {
    super(message, { status: 403, code: 'FORBIDDEN' });
  }
}
