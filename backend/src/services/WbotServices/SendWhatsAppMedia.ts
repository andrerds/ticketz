import ffmpegPath from "@ffmpeg-installer/ffmpeg";
import { exec } from "child_process";
import fs from "fs";
import iconv from "iconv-lite";
import {
  AnyMediaMessageContent,
  AnyMessageContent,
  WAMessage
} from "libzapitu-rf";
import mime from "mime-types";
import path from "path";
import { Readable } from "stream";
import AppError from "../../errors/AppError";
import CheckSettings from "../../helpers/CheckSettings";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import saveMediaToFile from "../../helpers/saveMediaFile";
import { URLCharEncoder } from "../../helpers/URLCharEncoder";
import Ticket from "../../models/Ticket";
import { logger } from "../../utils/logger";
import { getJidOf } from "./getJidOf";
import { verifyMediaMessage, verifyMessage } from "./wbotMessageListener";

interface Request {
  media: Express.Multer.File;
  ticket: Ticket;
  caption?: string;
  ptt?: boolean;
}

export type MediaInfo = {
  mediaUrl: string;
  mimetype: string;
  filename: string;
  fileSize: number;
};

const publicFolder = __dirname.endsWith("/dist")
  ? path.resolve(__dirname, "..", "public")
  : path.resolve(__dirname, "..", "..", "..", "public");

const supportedImages = ["image/png", "image/jpg", "image/jpeg", "image/webp"];

const processRecordedAudio = async (audio: string): Promise<Readable> => {
  const outputAudio = `${publicFolder}/${new Date().getTime()}.ogg`;
  return new Promise((resolve, reject) => {
    exec(
      `${ffmpegPath.path} -i "${audio}" -vn -ar 16000 -ac 1 -c:a libopus -b:a 0 ${outputAudio}`,
      (error, _stdout, _stderr) => {
        if (error) reject(error);
        resolve(fs.createReadStream(outputAudio));
      }
    );
  });
};

export const getMessageFileOptions = async (
  fileName: string,
  pathMedia: string,
  mimetype?: string,
  ptt?: boolean
): Promise<AnyMediaMessageContent> => {
  mimetype = mimetype || mime.lookup(pathMedia) || "application/octet-stream";

  const url = pathMedia.match(/^https?:\/\//) && {
    url: pathMedia
  };

  try {
    let options: AnyMediaMessageContent;

    if (mimetype.startsWith("video/")) {
      options = {
        fileName,
        video: url || { stream: fs.createReadStream(pathMedia) }
      };
    } else if (mimetype === "audio/ogg") {
      options = {
        fileName,
        audio: url || { stream: fs.createReadStream(pathMedia) },
        mimetype: "audio/ogg; codecs=opus",
        ptt: true
      };
    } else if (mimetype.startsWith("audio/")) {
      const needConvert = fileName.includes("audio-record-site");
      options = {
        fileName,
        audio: url || {
          stream: needConvert
            ? await processRecordedAudio(pathMedia)
            : fs.createReadStream(pathMedia)
        },
        mimetype: !url && needConvert ? "audio/ogg; codecs=opus" : mimetype,
        ptt: (!url && needConvert) || !!ptt
      };
    } else if (supportedImages.includes(mimetype)) {
      options = {
        fileName,
        image: url || { stream: fs.createReadStream(pathMedia) }
      };
    } else {
      options = {
        fileName,
        document: url || { stream: fs.createReadStream(pathMedia) },
        mimetype
      };
    }

    return options;
  } catch (error) {
    logger.error(
      { message: error.message },
      "Error getting message file options"
    );
    return null;
  }
};

export const sendWhatsappFile = async (
  ticket: Ticket,
  mediaInfo: MediaInfo,
  options: AnyMediaMessageContent
): Promise<WAMessage> => {
  try {
    const wbot = await GetTicketWbot(ticket);

    const sentMessage = await wbot.sendMessage(getJidOf(ticket), options);

    await verifyMediaMessage(sentMessage, ticket, ticket.contact, {
      mediaInfo
    });

    return sentMessage;
  } catch (error) {
    logger.error({ message: error.message }, "Error sending WhatsApp message");
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export const SendWhatsAppMessage = async (
  ticket: Ticket,
  options: AnyMessageContent
): Promise<WAMessage> => {
  try {
    const wbot = await GetTicketWbot(ticket);

    const sentMessage = await wbot.sendMessage(getJidOf(ticket), options);

    wbot.cacheMessage(sentMessage);

    await verifyMessage(sentMessage, ticket, ticket.contact);

    return sentMessage;
  } catch (error) {
    logger.error({ message: error.message }, "Error sending WhatsApp message");
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export const SendWhatsAppMedia = async ({
  media,
  ticket,
  caption,
  ptt
}: Request): Promise<WAMessage> => {
  try {
    const pathMedia = media.path;

    let fileName = "";
    try {
      fileName = iconv.decode(
        Buffer.from(media.originalname, "binary"),
        "utf8"
      );
    } catch (error) {
      logger.error(
        { message: error.message },
        "Error converting filename to UTF-8:"
      );
    }

    const fileLimit = parseInt(await CheckSettings("uploadLimit", "15"), 10);

    // convert multer file to Readable
    const readableFile = fs.createReadStream(pathMedia);
    const savedResult = await saveMediaToFile(
      {
        data: readableFile,
        mimetype: media.mimetype,
        filename: fileName || media.originalname
      },
      ticket
    );
    readableFile.destroy();

    const mediaInfo = {
      mediaUrl: savedResult.mediaPath,
      mimetype: media.mimetype,
      filename: fileName || media.originalname,
      fileSize: savedResult?.fileSize || 0
    };

    if (media.size > fileLimit * 1024 * 1024) {
      const fileUrl = savedResult.mediaPath.startsWith("http")
        ? savedResult.mediaPath
        : `${process.env.BACKEND_URL}/public/${savedResult.mediaPath}`;
      return SendWhatsAppMessage(ticket, {
        text: `📎 *${fileName}*\n\n🔗 ${URLCharEncoder(fileUrl)}`
      });
    }

    const options = await getMessageFileOptions(
      fileName,
      pathMedia,
      media.mimetype,
      ptt
    );
    return sendWhatsappFile(ticket, mediaInfo, {
      caption: caption || undefined,
      fileName,
      ...options
    } as AnyMediaMessageContent);
  } catch (error) {
    logger.error({ message: error.message }, "Error sending WhatsApp media");
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendWhatsAppMedia;
