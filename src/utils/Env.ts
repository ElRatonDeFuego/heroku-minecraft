import { default as dotenv } from "dotenv";

dotenv.config();

export const BACKUP_LOCAL_DIRECTORY =
  process.env.BACKUP_LOCAL_DIRECTORY ?? "./vendor/minecraft";

export const BACKUP_LOCKFILE =
  process.env.BACKUP_LOCKFILE ?? "./.remoteOperationInProgress.lock";

export const BACKUP_SERVER_SFTP_HOST = process.env.BACKUP_SERVER_SFTP_HOST;

export const BACKUP_SERVER_SFTP_PASSWORD =
  process.env.BACKUP_SERVER_SFTP_PASSWORD;

export const BACKUP_SERVER_SFTP_LOAD_PATH =
  process.env.BACKUP_SERVER_SFTP_LOAD_PATH ?? "/minecraft-server/vendor";

export const BACKUP_SERVER_SFTP_PORT = parseInt(
  process.env.BACKUP_SERVER_SFTP_PORT ?? "22",
  10
);

export const BACKUP_SERVER_SFTP_SAVE_PATH =
  process.env.BACKUP_SERVER_SFTP_SAVE_PATH ?? "/minecraft-server/backup";

export const BACKUP_SERVER_SFTP_USERNAME =
  process.env.BACKUP_SERVER_SFTP_USERNAME;

export const HEROKU_APP_NAME =
  process.env.HEROKU_APP_NAME ?? "clems-minecraft-server";

export const MINECRAFT_SERVER_HOST = "0.0.0.0";

export const MINECRAFT_SERVER_PORT = 25566;

export const WEBSERVER_PORT = parseInt(process.env.PORT ?? "8080", 10);

export interface Env {
  [key: string]: string | number;
}
