import { pipe } from "../fp.js";

export const validateSchemaReduce = (schema, body) =>
  Object.keys(schema).reduce(
    (acc, key) => schemaReducer(acc, key, schema, body),
    {},
  );

export const validateSchema = (schema, body) => {
  const validatedBody = validateSchemaReduce(schema, body);

  return objectHasErrors(validatedBody)
    ? { errors: formatValidatedStructure(validatedBody) }
    : validatedBody;
};

const formatValue = (value, formatters) =>
  formatters.reduce((acc, formatter) => formatter(acc), value);

const validateArray = (array, schema) =>
  array
    .map((item, index) => validateArrayItem(item, schema, index))
    .filter(Boolean);

const validateArrayItem = (value, schema, elementIndex) => {
  const { type, items, properties, validator } = schema;

  if (type === "array") {
    if (!Array.isArray(value))
      return { error: `${elementIndex}-index item must be an array` };

    return value
      .map((item, index) => validateArrayItem(item, items, index))
      .filter(Boolean);
  }

  if (schema.type === "object")
    return validateSchemaReduce(properties, value || {});

  if (typeof value !== schema.type || (validator && !schema.validator(value)))
    return { error: `${elementIndex}-index item failed validation` };

  return value;
};

const validatedAcc = ({ condition, data, acc, key, type, errorMessage }) =>
  condition
    ? {
        ...data,
        acc: { ...acc, [key]: { error: errorMessage(key, type) } },
      }
    : data;

const checkUndefined = (data) => {
  const { key, body, acc } = data;

  const condition = body[key] === undefined;
  const errorMessage = (errorKey) => `${errorKey} must not be undefined`;

  return validatedAcc({ condition, data, acc, key, errorMessage });
};

const checkRequired = (data) => {
  const { key, value, required, acc } = data;

  const condition =
    required && !value && typeof value !== "boolean" && value !== 0;
  const errorMessage = (errorKey) => `${errorKey} is required field`;

  return validatedAcc({ condition, data, acc, key, errorMessage });
};

const checkType = (data) => {
  const { key, value, type, acc } = data;

  const condition =
    type === "array"
      ? !Array.isArray(value)
      : value !== null && typeof value !== type;

  const errorMessage = (errorKey, keyType) =>
    `${errorKey} must be of type ${keyType}`;

  return validatedAcc({ condition, data, acc, key, type, errorMessage });
};

const checkCustomValidation = (data) => {
  const { key, value, validator, acc, validatorErrorMessage } = data;

  const condition = validator && value && !validator(value);

  const errorDescription = validatorErrorMessage || "failed custom validation";

  const errorMessage = (errorKey) => `${errorKey} - ${errorDescription}`;

  return validatedAcc({ condition, data, acc, key, errorMessage });
};

const checkNullable = (data) => {
  const { key, value, required, acc } = data;

  return !required && value === null
    ? { ...data, acc: { ...acc, [key]: value } }
    : data;
};

const checkArrayType = (data) => {
  const { key, value, type, items, acc } = data;
  if (type !== "array") return data;

  const result = Array.isArray(value)
    ? validateArray(value, items)
    : { error: `${key} must be an array` };

  return {
    ...data,
    acc: { ...acc, [key]: result },
  };
};

const checkObjectType = (data) => {
  const { key, value, type, properties, acc } = data;

  return type === "object" && properties
    ? {
        ...data,
        acc: { ...acc, [key]: validateSchemaReduce(properties, value || {}) },
      }
    : data;
};

const assignValue = (data) => {
  const { key, value, acc } = data;
  const accHasError = objectHasErrors(acc[key]);

  return {
    ...data,
    acc: { ...acc, [key]: accHasError ? acc[key] : value },
  };
};

const validateValue = pipe(
  checkUndefined,
  checkRequired,
  checkNullable,
  checkArrayType,
  checkObjectType,
  checkType,
  checkCustomValidation,
  assignValue,
);

const schemaReducer = (acc, key, schema, body) => {
  const {
    type,
    required,
    defaultValue,
    formatters,
    validator,
    properties,
    items,
    validatorErrorMessage,
  } = schema[key];

  if (!(key in body) && !required) return acc;

  const value =
    (formatters ? formatValue(body[key], formatters) : body[key]) ??
    defaultValue ??
    null;

  return validateValue({
    acc,
    key,
    value,
    type,
    required,
    validator,
    properties,
    items,
    body,
    validatorErrorMessage,
  }).acc;
};

const objectHasErrors = (data) => {
  if (typeof data === "object" && data !== null) {
    if (Object.prototype.hasOwnProperty.call(data, "error")) {
      return true;
    }

    if (Array.isArray(data)) {
      return data.some((item) => objectHasErrors(item));
    }

    return Object.keys(data).some((key) => objectHasErrors(data[key]));
  }

  return false;
};

const formatArray = (array) => {
  if (Array.isArray(array)) {
    const arrayValidated = array.map((item) => formatValidatedStructure(item));
    const filteredArray = arrayValidated.filter(
      (item) => Object.keys(item).length,
    );
    if (filteredArray.length) return filteredArray;
  }
  return false;
};

const formatObject = (object) => {
  if (typeof object === "object" && !object.error) {
    const objectValidated = formatValidatedStructure(object);
    if (Object.keys(objectValidated).length) return objectValidated;
  }

  return false;
};

const formatValidatedStructure = (validatedObject) =>
  Object.keys(validatedObject).reduce((acc, key) => {
    const value = validatedObject[key];
    if (value === null) return acc;

    const filteredArray = formatArray(value);
    if (filteredArray) {
      acc[key] = filteredArray;
      return acc;
    }

    const filteredObject = formatObject(value);
    if (filteredObject) {
      acc[key] = filteredObject;
      return acc;
    }

    if (value.error) acc[key] = value;

    return acc;
  }, {});
