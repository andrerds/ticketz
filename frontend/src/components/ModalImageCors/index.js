import { Tooltip, Typography } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import { Block } from "@material-ui/icons";
import clsx from "clsx";

import ModalImage from "react-modal-image";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
  messageMedia: {
    objectFit: "cover",
    width: "100%",
    height: 200,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },

  messageMediaSticker: {
    width: 200,
    height: 200,
  },

  messageMediaDeleted: {
    filter: "grayscale(1)",
    opacity: 0.4,
  },

  deletedPlaceholder: {
    width: "100%",
    height: 200,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.palette.grey[200],
    borderRadius: 8,
    padding: theme.spacing(2),
  },

  deletedIcon: {
    fontSize: 48,
    color: theme.palette.grey[500],
    marginBottom: theme.spacing(1),
  },
}));

const ModalImageCors = ({ imageUrl, isDeleted, data }) => {
  const classes = useStyles();

  if (imageUrl && imageUrl.startsWith("deleted:")) {
    return (
      <Tooltip title={i18n.t("messages.mediaDeleted.tooltip")}>
        <div className={classes.deletedPlaceholder}>
          <Block className={classes.deletedIcon} />
          <Typography variant="body2" color="textSecondary">
            {i18n.t("messages.mediaDeleted.text")}
          </Typography>
        </div>
      </Tooltip>
    );
  }

  return (
    <ModalImage
      className={[
        clsx(classes.messageMedia, {
          [classes.messageMediaDeleted]: isDeleted,
          [classes.messageMediaSticker]:
            data && "stickerMessage" in data.message,
        }),
      ]}
      smallSrcSet={imageUrl}
      medium={imageUrl}
      large={imageUrl}
      showRotate={true}
      imageBackgroundColor="unset"
      alt="image"
    />
  );
};

export default ModalImageCors;
