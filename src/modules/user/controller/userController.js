import { httpResponse, httpResponseError } from "../../../shared/utils/http/httpResponse.js";
import { generalStatus, userStatus } from "../../../shared/utils/http/httpStatus.js";
import { validateSchema } from "../../../shared/utils/validation/requestValidation.js";
import {
  emailValidator,
  isValidObjectId,
} from "../../../shared/utils/validation/validators.js";
import {
  createUser as serviceCreateUser,
  getUserById,
  getUser as serviceGetUser,
  updateUser as serviceUpdateUser,
  deleteUser as serviceDeleteUser,
} from "../services/userServices.js";
import {
  generateTelegramLink,
  disconnectTelegram,
} from "../../../services/telegramLinkService.js";
import { uploadAvatar, deleteAvatar, ASSET_TYPES } from "../../media/index.js";

const createUserSchema = {
  name: { type: "string", required: true },
  email: {
    type: "string",
    required: true,
    validator: emailValidator,
    validatorErrorMessage: "must be a valid email",
  },
  avatar: { type: "string", required: false },
};

const updateUserSchema = {
  name: { type: "string", required: false },
  email: {
    type: "string",
    required: false,
    validator: emailValidator,
    validatorErrorMessage: "must be a valid email",
  },
  avatar: { type: "string", required: false },
  description: { type: "string", required: false },
  address: { type: "string", required: false },
  phone: { type: "string", required: false },
  website: { type: "string", required: false },
};

const createUser = async (req, res) => {
  try {
    const { body } = req;

    const validated = validateSchema(createUserSchema, body);
    if (validated.errors) {
      httpResponseError(res, {
        ...userStatus.VALIDATION_ERROR,
        data: validated.errors,
      });
      return;
    }

    const user = await serviceCreateUser(validated);
    httpResponse(res, generalStatus.SUCCESS, user);
  } catch (error) {
    httpResponseError(res, error);
  }
};

const getUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      httpResponseError(res, generalStatus.BAD_REQUEST);
      return;
    }

    const user = await getUserById(id);
    if (!user) {
      httpResponseError(res, generalStatus.NOT_FOUND);
      return;
    }
    httpResponse(res, generalStatus.SUCCESS, user);
  } catch (error) {
    httpResponseError(res, error);
  }
};

const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { body } = req;

    if (!isValidObjectId(id)) {
      httpResponseError(res, generalStatus.BAD_REQUEST);
      return;
    }

    const validated = validateSchema(updateUserSchema, body);
    if (validated.errors) {
      httpResponseError(res, {
        ...userStatus.VALIDATION_ERROR,
        data: validated.errors,
      });
      return;
    }

    if (!Object.keys(validated).length) {
      httpResponseError(res, userStatus.NOTHING_TO_UPDATE);
      return;
    }

    const user = await serviceUpdateUser(id, validated);
    if (!user) {
      httpResponseError(res, generalStatus.NOT_FOUND);
      return;
    }
    httpResponse(res, generalStatus.SUCCESS, user);
  } catch (error) {
    httpResponseError(res, error);
  }
};

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      httpResponseError(res, generalStatus.BAD_REQUEST);
      return;
    }

    const deleted = await serviceDeleteUser(id);
    if (!deleted) {
      httpResponseError(res, generalStatus.NOT_FOUND);
      return;
    }
    httpResponse(res, userStatus.DELETED);
  } catch (error) {
    httpResponseError(res, error);
  }
};

const getProfile = async (req, res) => {
  try {
    const { id } = req.user;

    const user = await getUserById(id);
    if (!user) {
      httpResponseError(res, generalStatus.NOT_FOUND);
      return;
    }
    httpResponse(res, generalStatus.SUCCESS, user);
  } catch (error) {
    httpResponseError(res, error);
  }
};

const connectTelegram = async (req, res) => {
  try {
    const { id } = req.user;
    const result = generateTelegramLink(id);
    httpResponse(res, generalStatus.SUCCESS, result);
  } catch (error) {
    httpResponseError(res, error);
  }
};

const disconnectTelegramHandler = async (req, res) => {
  try {
    const { id } = req.user;
    await disconnectTelegram(id);
    httpResponse(res, generalStatus.SUCCESS);
  } catch (error) {
    httpResponseError(res, error);
  }
};

const uploadUserAvatar = async (req, res) => {
  try {
    if (!req.file) {
      httpResponseError(res, {
        ...userStatus.VALIDATION_ERROR,
        data: { file: { error: "File is required" } },
      });
      return;
    }

    const { id } = req.user;
    const { url } = await uploadAvatar({
      assetType: ASSET_TYPES.USER_AVATAR,
      ownerId: id,
      file: req.file,
    });

    const updated = await serviceUpdateUser(id, { avatar: url });
    if (!updated) {
      httpResponseError(res, generalStatus.NOT_FOUND);
      return;
    }
    httpResponse(res, generalStatus.SUCCESS, updated);
  } catch (error) {
    httpResponseError(res, error);
  }
};

const deleteUserAvatar = async (req, res) => {
  try {
    const { id } = req.user;
    const current = await getUserById(id);
    if (current && current.avatar) {
      await deleteAvatar({
        assetType: ASSET_TYPES.USER_AVATAR,
        ownerId: id,
      });
    }
    const updated = await serviceUpdateUser(id, { avatar: "" });
    if (!updated) {
      httpResponseError(res, generalStatus.NOT_FOUND);
      return;
    }
    httpResponse(res, generalStatus.SUCCESS, updated);
  } catch (error) {
    httpResponseError(res, error);
  }
};

export { createUser, getUser, updateUser, deleteUser, getProfile, connectTelegram, disconnectTelegramHandler, uploadUserAvatar, deleteUserAvatar };
