const { User, validate } = require("../models/User.model");
const bcrypt = require("bcryptjs");
const sendEmail = require("../utils/sendEmail");
const Group = require("../models/Group.model");
const jwt = require("jsonwebtoken");
const Joi = require("joi");
const passwordComplexity = require("joi-password-complexity");
const { getEvents, deleteEvent } = require("../utils/googleCalendar");

exports.signup = async (req, res, next) => {
  try {
    const { error } = validate(req.body);
    if (error)
      return res.status(400).send({ message: error.details[0].message });

    let user = await User.findOne({ email: req.body.email });
    if (user)
      return res.status(409).send({ message: "E-Mail bereits in Gebrauch" });

    const salt = await bcrypt.genSalt(Number(process.env.SALT));
    const hashPassword = await bcrypt.hash(req.body.password, salt);
    const randomCode = Math.floor(1000 + Math.random() * 9000).toString();

    user = await new User({
      ...req.body,
      password: hashPassword,
      code: randomCode,
      role: "user"
    }).save();
    // await sendEmail(user.email, "Verify Email", user.code);

    const { _id, email } = user;
    const payload = { _id, email };

    const options = {
      algorithm: "HS256",
      expiresIn: "6h",
    };

    const authToken = jwt.sign(payload, process.env.TOKEN_SECRET, options);

    res.status(201).send({
      authtoken: authToken,
    });
  } catch (error) {
    res.status(500).send({ message: `${error}` });
  }
};

exports.verified = async (req, res, next) => {
  try {
    const user = await User.findOne({ code: req.body.code });
    if (!user) return res.status(400).send({ message: "Ungültiger Code" });

    // res.status(200).json(user);
    res.redirect(`/group/create/${user.email}`)
  } catch (error) {
    res.status(400).send({ message: `${error}` });
  }
};

exports.verified = async (req, res, next) => {
  try {
    const user = await User.findOne({ code: req.body.code });
    if (!user) return res.status(400).send({ message: "Ungültiger Code" });

    await User.updateOne({ _id: user._id }, { verified: true, code: "", verificationExpires: null });

    res.status(200).send({message: "All gravy here, boss"});
  } catch (error) {
    res.status(400).send({ message: `${error}` });
  }
};

exports.reset = async (req, res, next) => {
  try {
    let user = await User.findOne({ email: req.body.email });
    if (!user)
      return res
        .status(409)
        .send({
          message:
            "Der Benutzer mit der angegebenen E-Mail-Adresse existiert nicht",
        });

    const url = `${process.env.BASE_URL}password-reset/${user._id}`;
    await sendEmail(user.email, "Password Reset", url);

    res
      .status(200)
      .send({
        message:
          "Der Link zum Zurücksetzen des Passworts wurde an Ihre E-Mail-Adresse gesendet",
      });
  } catch (error) {
    res.status(500).send({ message: `${error}` });
  }
};

exports.verifyReset = async (req, res, next) => {
  try {
    const user = await User.findOne({ _id: req.params.id });
    if (!user) return res.status(400).send({ message: "Invalid link" });

    res.status(200).send({ message: "Valid url " });
  } catch (error) {
    res.status(500).send({ message: `${error}` });
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const passwordSchema = Joi.object({
      password: passwordComplexity().required().label("Password"),
    });
    const { error } = passwordSchema.validate(req.body);
    if (error)
      return res.status(400).send({ message: error.details[0].message });

    const user = await User.findOne({ _id: req.params.id });
    if (!user) return res.status(400).send({ message: "Invalid link" });

    const salt = await bcrypt.genSalt(Number(process.env.SALT));
    const hashPassword = await bcrypt.hash(req.body.password, salt);

    user.password = hashPassword;
    await user.save();

    res.status(200).send({ message: "Passwort erfolgreich zurückgesetzt" });
  } catch (error) {
    res.status(500).send({ message: `${error}` });
  }
};

exports.id = async (req, res, next) => {
  try {
    const user = await User.findOne({ _id: req.params.id }).populate("groups");
    res.status(200).send({ user });
  } catch (error) {
    res.status(200).send({ message: "E-Mail erfolgreich verifiziert" });
  }
};

exports.meetings = async (req, res, next) => {
  try {
    let user = await User.findOne({ _id: req.params.id });
    let start = "2023-10-03T00:00:00.000Z";
    let end = "2024-10-06T00:00:00.000Z";
    let event = await getEvents(start, end);
    let mappedEvent = user.meetings.map((meetings) =>
      event.filter((events) => events.id.includes(meetings))
    );
    res.status(200).send(mappedEvent);
  } catch (error) {
    res.status(500).send(`${error}`);
  }
};

exports.edit = async (req, res, next) => {
  try {
    let user = await User.findOne({ _id: req.params.id });
    if (!user) return res.status(400).send({ message: "Invalid Link" });

    let newUser = await User.updateOne({ _id: req.params.id }, { ...req.body });

    let newNewUser = await User.findOne({ _id: req.params.id });

    if (user.email !== newNewUser.email) {
      await sendEmail(newNewUser.email, "Verify Email", user.code);
    }

    res.status(200).send({ message: "Benutzer erfolgreich aktualisiert" });
  } catch (error) {
    res.status(500).send({ message: `${error}` });
  }
};

exports.delete = async (req, res, next) => {
  try {
    let user = await User.findOne({ _id: req.params.id });
    if (!user) return res.status(400).send({ message: "Invalid Link" });

    const data = await Group.updateMany(
      {
        users: {
          $in: [req.params.id],
        },
        // moderator: req.params.id
      },
      {
        $pull: {
          users: req.params.id,
          // moderator: req.params.id
        },
      }
    );

    user.moderatedGroups.map(async (groups) => {
      const specGroup = await Group.findOne({ _id: groups });

      await User.updateMany(
        {
          joinedGroups: {
            $in: [groups],
          },
        },
        {
          $pull: {
            joinedGroups: groups,
            meetings: specGroup.meeting,
          },
        }
      );
    });

    user.meetings.map((meetings) => deleteEvent(meetings));

    let deletedGroups = await Group.deleteMany({ moderator: req.params.id });

    user = await User.deleteOne({ _id: req.params.id });

    res.status(200).send({ message: "Benutzer erfolgreich gelöscht", data });
  } catch (error) {
    res.status(500).send({ message: `${error}` });
  }
};

exports.verifyToken = (req, res, next) => {
  console.log(`req.payload`, req.payload);
  res.status(200).json(req.payload);
};
