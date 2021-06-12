/* eslint-disable max-lines */

import { execSync } from "child_process";
import fs from "fs";
import { glob } from "glob";
import SftpClient from "ssh2-sftp-client";

import {
  BACKUP_LOCAL_DIRECTORY,
  BACKUP_LOCKFILE,
  BACKUP_SERVER_SFTP_HOST,
  BACKUP_SERVER_SFTP_LOAD_PATH,
  BACKUP_SERVER_SFTP_PASSWORD,
  BACKUP_SERVER_SFTP_PORT,
  BACKUP_SERVER_SFTP_SAVE_PATH,
  BACKUP_SERVER_SFTP_USERNAME,
} from "../utils/Env";

let sftp: SftpClient;

const connect = async () => {
  sftp = new SftpClient();

  return sftp.connect({
    host: BACKUP_SERVER_SFTP_HOST,
    password: BACKUP_SERVER_SFTP_PASSWORD,
    port: BACKUP_SERVER_SFTP_PORT,
    username: BACKUP_SERVER_SFTP_USERNAME,
  });
};

let remoteFiles: Array<string> = [];
const remotePromiseFunctions: Array<() => Promise<unknown>> = [];
let totalRemoteSize = 0;
let remoteSizeDone = 0;
let remoteSizeRemaining = 0;

const retrieveFile = ({
  filePath,
  size,
}: {
  filePath: string;
  size: number;
}) => {
  const localName = filePath.replace(
    BACKUP_SERVER_SFTP_LOAD_PATH,
    BACKUP_LOCAL_DIRECTORY
  );

  return async () =>
    sftp
      // eslint-disable-next-line no-null/no-null
      .get(filePath, localName, { encoding: null })
      .then(() => {
        remoteSizeDone += size;
        remoteSizeRemaining -= size;
        remoteFiles = remoteFiles.filter((n) => n !== filePath);
        const percent = Math.round((remoteSizeDone / totalRemoteSize) * 100.0);

        console.log(
          `${percent}% done, ${remoteFiles.length} file${
            remoteFiles.length === 1 ? "" : "s"
          } left ..`
        );

        if (remoteFiles.length === 1) {
          console.log(
            `Waiting on ${
              remoteFiles[0]
            } (${remoteSizeRemaining} bytes / ~${Math.round(
              remoteSizeRemaining / (1024 * 1024)
            )} MB) ..`
          );
        }
      })
      .catch((error: string) => {
        console.log(
          `Error copying remote file "${filePath}" to local path "${localName} :"`
        );

        console.log(
          `${error}\nRetrieval from backup FAILED! Not starting Minecraft server!`
        );

        process.exit(1);
      });
};

const retrieveDirectory = async (dirName: string) => {
  const localName = dirName.replace(
    BACKUP_SERVER_SFTP_LOAD_PATH,
    BACKUP_LOCAL_DIRECTORY
  );

  execSync(`mkdir -p "${localName}"`);

  const list = await sftp.list(dirName);

  await Promise.allSettled(
    list.map(async (elementInDir) => {
      const { name, size, type } = elementInDir;

      if (type === "-") {
        const filePath = `${dirName}/${name}`;

        if (!filePath.includes("/logs/")) {
          remoteFiles.push(filePath);

          totalRemoteSize += size;
          remoteSizeRemaining += size;

          remotePromiseFunctions.push(retrieveFile({ filePath, size }));
        }
      } else if (type === "d") {
        await retrieveDirectory(`${dirName}/${name}`);
      }
    })
  );
};

const retrieveEverything = async () => {
  if (fs.existsSync(BACKUP_LOCKFILE)) {
    console.log("Remote operation already in progress, skipping.");

    return Promise.resolve();
  }

  execSync(`touch ${BACKUP_LOCKFILE}`);

  console.log("Connecting to backup server ..");
  await connect();

  console.log("Listing files on backup server ..");
  await retrieveDirectory(BACKUP_SERVER_SFTP_LOAD_PATH);

  console.log(
    `Retrieving ${remoteFiles.length} files from backup server (~${Math.round(
      totalRemoteSize / (1024 * 1024)
    )} MB) ..`
  );

  await Promise.allSettled(
    remotePromiseFunctions.map(async (pf) => pf())
  ).finally(() => {
    execSync(`rm -f ${BACKUP_LOCKFILE}`);
  });

  return sftp.end();
};

let localFiles: Array<string> = [];
const createRemoteDirsPromiseFunctions: Record<string, () => Promise<unknown>> =
  {};
const saveFilePromiseFunctions: Array<() => Promise<unknown>> = [];
let totalLocalSize = 0;

const saveFile = ({ filePath }: { filePath: string }) => {
  const remotePath = filePath.replace(
    BACKUP_LOCAL_DIRECTORY,
    BACKUP_SERVER_SFTP_SAVE_PATH
  );

  return async () =>
    sftp
      // eslint-disable-next-line no-null/no-null
      .put(filePath, remotePath, { encoding: null })
      .then(console.log)
      .catch((error: string) => {
        console.log(
          `Error copying local file "${filePath}" to remote path "${remotePath} :"`
        );

        console.log(`${error}\nBackup to server FAILED!`);
      });
};

const createRemoteDirIfNeeded = ({
  localDirName,
}: {
  localDirName: string;
}) => {
  const remoteDir = localDirName.replace(
    BACKUP_LOCAL_DIRECTORY,
    BACKUP_SERVER_SFTP_SAVE_PATH
  );

  createRemoteDirsPromiseFunctions[remoteDir] = async () => {
    const dirExists = (await sftp.exists(remoteDir)) !== false;

    if (!dirExists) {
      await sftp.mkdir(remoteDir, true);
    }
  };
};

const processLocalDir = ({
  dirName,
  recursive,
}: {
  dirName: string;
  recursive: boolean;
}) => {
  const localFilesInDir: Array<string> = [];

  createRemoteDirIfNeeded({ localDirName: dirName });

  const localElementsInDir = glob.sync(`${dirName}/*`, { dot: true });

  localElementsInDir.forEach((element) => {
    const { nlink, size } = fs.statSync(element);

    if (nlink === 1) {
      // file
      if (!element.endsWith(".jar")) {
        if (
          recursive ||
          element.endsWith(".json") ||
          element.endsWith(".properties")
        ) {
          totalLocalSize += size;
          localFilesInDir.push(element);
          saveFilePromiseFunctions.push(saveFile({ filePath: element }));
        }
      }
    } else if (recursive) {
      // directory to process recursively
      localFilesInDir.push(...processLocalDir({ dirName: element, recursive }));
    }
  });

  return localFilesInDir;
};

const saveWorldAndConfig = async () => {
  if (fs.existsSync(BACKUP_LOCKFILE)) {
    console.log("Remote operation already in progress, skipping.");

    return Promise.resolve();
  }

  execSync(`touch ${BACKUP_LOCKFILE}`);

  const startedAt = Date.now();

  console.log(
    `Backup of world and config files started on ${new Date().toISOString()}.`
  );

  await connect();

  totalLocalSize = 0;

  localFiles = [
    ...processLocalDir({ dirName: BACKUP_LOCAL_DIRECTORY, recursive: false }),
    ...processLocalDir({
      dirName: `${BACKUP_LOCAL_DIRECTORY}/world`,
      recursive: true,
    }),
  ];

  console.log(
    `Copying ${localFiles.length} files to backup server (~${Math.round(
      totalLocalSize / (1024 * 1024)
    )} MB) ..`
  );

  for (const pf of Object.keys(createRemoteDirsPromiseFunctions)
    .sort()
    .reverse()) {
    await createRemoteDirsPromiseFunctions[pf]();
  }

  await Promise.allSettled(saveFilePromiseFunctions.map(async (pf) => pf()))
    .then(() => {
      console.log(
        `Backup done on ${new Date().toISOString()} (took ${Math.round(
          (Date.now() - startedAt) / 1000
        )}s)`
      );
    })
    .finally(() => {
      execSync(`rm -f ${BACKUP_LOCKFILE}`);
    });

  return sftp.end();
};

export const backupServer = {
  retrieveEverything,
  saveWorldAndConfig,
};
