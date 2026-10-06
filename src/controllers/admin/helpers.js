import { assertUploadOk } from '../../middlewares/upload.js';
import { ValidationError } from '../../utils/errors.js';

/**
 * Runs a form action; on validation failure re-renders the form with the submitted values and errors.
 */
export function formAction(action, renderForm) {
  return async (req, res) => {
    try {
      assertUploadOk(req);
      await action(req, res);
    } catch (error) {
      if (!(error instanceof ValidationError)) throw error;
      res.status(422);
      await renderForm(req, res, { values: req.body, errors: error.details });
    }
  };
}

export const idParam = (req, name = 'id') => {
  const value = Number.parseInt(req.params[name], 10);
  return Number.isInteger(value) && value > 0 ? value : 0;
};

export const asArray = (value) => (value === undefined ? [] : Array.isArray(value) ? value : [value]);
