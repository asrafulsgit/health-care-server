import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import AppError from "../errorHelpers/appError";
import { CUSTOM_ERROR } from "../utils/constants";
import jwt, { JwtPayload } from "jsonwebtoken";
import { envVars } from "../config";
import { prisma } from "../shared/prisma";
import { UserStatus } from "@prisma/client";

export const authentication =
  (...roles: string[]) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = req.cookies.accessToken || req.headers.authorization;

      if (!token) {
        throw new AppError(
          httpStatus.NOT_FOUND,
          "Token not found.",
          CUSTOM_ERROR.TOKEN_NOT_FOUND,
        );
      }
      const verified = jwt.verify(
        token,
        envVars.JWT_ACCESS_TOKEN_SECRET,
      ) as JwtPayload;

      const user = await prisma.user.findUnique({
        where: {
          email: verified.email,
        },
      });

      if (!user) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          `User is not found`,
          CUSTOM_ERROR.USER_NOT_FOUND,
        );
      }
      if (!user.isVerified) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          `User is not verified`,
          CUSTOM_ERROR.USER_NOT_VERIFIED,
        );
      }
      if (user.status !== UserStatus.ACTIVE) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          `User is ${user.status}`,
          user.status === UserStatus.DELETED
            ? CUSTOM_ERROR.USER_DELETED
            : CUSTOM_ERROR.USER_INACTIVE,
        );
      }

      if (!roles.includes((verified as JwtPayload).role)) {
        throw new AppError(
          httpStatus.FORBIDDEN,
          "You can not view this route!",
          CUSTOM_ERROR.ROLE_FORBIDDEN,
        );
      }
      req.user = verified;
      next();
    } catch (error) {
      next(error);
    }
  };
