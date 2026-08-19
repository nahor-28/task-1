function makeValidator(field) {
  return (schema) => (req, res, next) => {
    const result = schema.safeParse(req[field]);
    if (!result.success) {
      return res.status(400).json({
        error: { message: result.error.issues[0].message, code: 'VALIDATION_ERROR' },
      });
    }
    req[field] = result.data;
    next();
  };
}

export const validate = makeValidator('body');
export const validateParams = makeValidator('params');
export const validateQuery = makeValidator('query');
