import { Transform } from 'class-transformer';
import { IsByteLength, IsEmail, IsString, MaxLength } from 'class-validator';
import {
  LOGIN_MAX_EMAIL_LENGTH,
  LOGIN_MAX_PASSWORD_BYTES,
} from '../constants/auth.constants.js';

export class LoginDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(LOGIN_MAX_EMAIL_LENGTH)
  email!: string;

  @IsString()
  @IsByteLength(1, LOGIN_MAX_PASSWORD_BYTES)
  password!: string;
}
