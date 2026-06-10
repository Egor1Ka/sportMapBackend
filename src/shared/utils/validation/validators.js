import mongoose from "mongoose";
import { RE_EMAIL } from "../../constants/validation.js";

const checkByRegex = (regex) => (value) => regex.test(value);

export const emailValidator = checkByRegex(RE_EMAIL);

export const isValuePositive = (value) => Number(value) > 0;

export const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);
