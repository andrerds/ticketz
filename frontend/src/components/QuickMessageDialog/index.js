import {
  Button,
  DialogActions,
  DialogContent,
  Grid,
  TextField,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import { Field, Form, Formik } from "formik";
import PropType from "prop-types";
import React, { useContext, useEffect, useState } from "react";
import * as Yup from "yup";
import { AuthContext } from "../../context/Auth/AuthContext";
import { i18n } from "../../translate/i18n";
import ButtonWithSpinner from "../ButtonWithSpinner";
import Dialog from "../Dialog";

import { get, has, isNil, isObject } from "lodash";

const MessageSchema = Yup.object().shape({
  shortcode: Yup.string()
    .min(3, "Too Short!")
    .max(50, "Too Long!")
    .required("Required"),
  message: Yup.string().min(3, "Too Short!").required("Required"),
});

const useStyles = makeStyles(theme => ({
  root: {
    "& .MuiTextField-root": {
      margin: theme.spacing(1),
      width: "350px",
    },
  },
  list: {
    width: "100%",
    maxWidth: "350px",
    maxHeight: "200px",
    backgroundColor: theme.palette.background.paper,
  },
  inline: {
    width: "100%",
  },
}));

function QuickMessageDialog(props) {
  const classes = useStyles();

  const initialMessage = {
    id: null,
    shortcode: "",
    message: "",
  };

  const { modalOpen, saveMessage, editMessage, onClose, messageSelected } =
    props;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [message, setMessage] = useState(initialMessage);
  const [loading, setLoading] = useState(false);

  const { user } = useContext(AuthContext);

  useEffect(() => {
    verifyAndSetMessage();
    setDialogOpen(modalOpen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen]);

  useEffect(() => {
    verifyAndSetMessage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageSelected]);

  const messageSelectedIsValid = () => {
    return (
      isObject(messageSelected) &&
      has(messageSelected, "id") &&
      !isNil(get(messageSelected, "id"))
    );
  };

  const verifyAndSetMessage = () => {
    if (messageSelectedIsValid()) {
      const { id, message, shortcode } = messageSelected;
      setMessage({ id, message, shortcode });
    } else {
      setMessage(initialMessage);
    }
  };

  const handleClose = () => {
    onClose();
    setLoading(false);
  };

  const handleSave = async values => {
    if (messageSelectedIsValid()) {
      editMessage({
        ...messageSelected,
        ...values,
        userId: user.id,
      });
    } else {
      saveMessage({
        ...values,
        userId: user.id,
      });
    }
    handleClose();
  };

  return (
    <Dialog
      title="Mensagem Rápida"
      modalOpen={dialogOpen}
      onClose={handleClose}
    >
      <Formik
        initialValues={message}
        enableReinitialize={true}
        validationSchema={MessageSchema}
        onSubmit={(values, actions) => {
          setLoading(true);
          setTimeout(() => {
            handleSave(values);
            actions.setSubmitting(false);
          }, 400);
        }}
      >
        {({ touched, errors }) => (
          <Form>
            <DialogContent className={classes.root} dividers>
              <Grid direction="column" container>
                <Grid item>
                  <Field
                    as={TextField}
                    name="shortcode"
                    label={i18n.t("quickMessages.dialog.shortcode")}
                    error={touched.shortcode && Boolean(errors.shortcode)}
                    helperText={touched.shortcode && errors.shortcode}
                    variant="outlined"
                  />
                </Grid>
                <Grid item>
                  <Field
                    as={TextField}
                    name="message"
                    minRows={6}
                    label={i18n.t("quickMessages.dialog.message")}
                    multiline={true}
                    spellCheck={true}
                    error={touched.message && Boolean(errors.message)}
                    helperText={touched.message && errors.message}
                    variant="outlined"
                  />
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleClose} color="primary">
                Cancelar
              </Button>
              <ButtonWithSpinner
                loading={loading}
                color="primary"
                type="submit"
                variant="contained"
                autoFocus
              >
                Salvar
              </ButtonWithSpinner>
            </DialogActions>
          </Form>
        )}
      </Formik>
    </Dialog>
  );
}

QuickMessageDialog.propType = {
  modalOpen: PropType.bool,
  onClose: PropType.func,
};

export default QuickMessageDialog;
