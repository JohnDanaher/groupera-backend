const Group = require("../models/Group.model");
const { User } = require("../models/User.model");
// const cloudinary = require("../utils/cloudinary");
const {
  dateTimeForCalender,
  insertEvent,
  getEvents,
  deleteEvent,
  getEvent,
  editEvent,
} = require("../utils/googleCalendar");
// const fetch = require("node-fetch");
const generateRoom = require("../utils/videoSDK");

exports.create = async (req, res, next) => {
  // const { img, when, frequency, day, time, length, token } = req.body;


  // Event for Google Calendar

  try {
    let group = await Group.findOne({ name: req.body.name });
    if (group)
      return res
        .status(409)
        .send({
          message: "Gruppe mit dem angegebenen Namen existiert bereits",
        });
    // if (img) {
    //   const uploadRes = await cloudinary.uploader.upload(img, {
    //     folder: "test",
    //   });
    //   if (uploadRes) {
    group = await new Group({
      ...req.body,
      // img: uploadRes
    }).save();
    let user = await User.findOne({ _id: group.moderator._id });
    if (user.moderator == "One") {
      let dateTime = dateTimeForCalender(group.date, group.time, group.length);
      let event = {
        summary: `${group.name}`,
        description: `Join code: ${group._id}`,
        start: {
          dateTime: dateTime["start"],
          timeZone: "Europe/Berlin",
        },
        end: {
          dateTime: dateTime["end"],
          timeZone: "Europe/Berlin",
        },
        recurrence: [
          `RRULE:FREQ=WEEKLY;INTERVAL=${+group.frequency}`,
        ],
      };
      const newEvent = await insertEvent(event);
      if (newEvent) {
        user = await User.updateOne(
          { _id: group.moderator._id },
          { $push: { moderatedGroups: group._id, meetings: newEvent.id } }
        );
        group = await Group.updateOne(
          { _id: group._id },
          { meeting: newEvent.id, verified: true }
        );
      }
    }
    // generateRoom(token, group._id, length);
    // }
    res.status(200).send({ message: "all good here, boss" });
    // }
  } catch (error) {
    res.status(500).send({ message: `${error}` });
  }
};

exports.verified = async (req, res, next) => {
  const { groupId } = req.params;

  try {
    let group = await Group.findOne({ _id: groupId });
    if (group) {
      let dateTime = dateTimeForCalender(group.date, group.time, group.length);
      let user = await User.findOne({ _id: group.moderator._id });
      if (user.moderator == "Two" || user.moderator == "Three") {
        let event = {
          summary: `${group.name}`,
          description: `Join code: ${group._id}`,
          start: {
            dateTime: dateTime["start"],
            timeZone: "Europe/Berlin",
          },
          end: {
            dateTime: dateTime["end"],
            timeZone: "Europe/Berlin",
          },
          recurrence: [
            `RRULE:FREQ=WEEKLY;INTERVAL=${+group.frequency}`,
          ],
        };
        const newEvent = await insertEvent(event);
        if (newEvent) {
          user = await User.updateOne(
            { _id: group.moderator._id },
            { $push: { moderatedGroups: group._id, meetings: newEvent.id } }
          );
          group = await Group.updateOne(
            { _id: group._id },
            { meeting: newEvent.id, verified: true }
          );
        }
      }
    }
  } catch (error) {
    res.status(500).send(`${error}`);
  }
};

// exports.create = async (req, res, next) => {
//   const { img, date, time, length, token } = req.body;

//   let dateTime = dateTimeForCalender(date, time, length);

//   // Event for Google Calendar
//   let event = {
//     summary: `${req.body.name}`,
//     description: `${req.body.description}`,
//     start: {
//       dateTime: dateTime["start"],
//       timeZone: "Europe/Berlin",
//     },
//     end: {
//       dateTime: dateTime["end"],
//       timeZone: "Europe/Berlin",
//     },
//   };

//   try {
//     let group = await Group.findOne({ name: req.body.name });
//     if (group)
//       return res
//         .status(409)
//         .send({ message: "Group with given name already exists" });
//     if (img) {
//       const uploadRes = await cloudinary.uploader.upload(img, {
//         upload_preset: "groupera-test",
//       });
//       if (uploadRes) {
//         const newEvent = await insertEvent(event);
//         if (newEvent) {
//           group = await new Group({
//             ...req.body,
//             img: uploadRes,
//             meetingId: newEvent.id,
//           }).save();
//           let user = await User.updateOne(
//             { _id: group.users[0]._id },
//             { $push: { groups: group._id } }
//           );
//         }
//         generateRoom(token, group._id, length);
//       }
//     }
//   } catch (error) {
//     res.status(500).send({ message: `${error}` });
//   }
// };

exports.all = async (req, res, next) => {
  try {
    let group = await Group.find();
    res.status(200).send(group);
  } catch (error) {
    res.status(500).send(`${error}`);
  }
};

exports.meetings = async (req, res, next) => {
  try {
    let group = await Group.findOne({ _id: req.params.groupId });
    let start = "2023-10-03T00:00:00.000Z";
    let end = "2026-10-06T00:00:00.000Z";
    let event = await getEvents(start, end);
    let filteredEvent = event.filter((events) =>
      events.id.includes(group.meeting)
    );
    res.status(200).send(filteredEvent);
  } catch (error) {
    res.status(500).send(`${error}`);
  }
};

exports.id = async (req, res, next) => {
  try {
    let group = await Group.findOne({ _id: req.params.groupId });
    if (!group) return res.status(400).send({ message: "Invalid Link" });

    res.status(200).send({ group });
  } catch (error) {
    res.status(500).send({ message: `${error}` });
  }
};

exports.join = async (req, res, next) => {
  const { currentUser } = req.body;
  try {
    let group = await Group.findOne({ _id: req.params.groupId });
    if (!group) return res.status(400).send({ message: "Invalid Link" });

    let user = await User.updateOne(
      { _id: currentUser },
      { $push: { joinedGroups: req.params.groupId, meetings: group.meeting } }
    );

    group = await Group.updateOne(
      { _id: req.params.groupId },
      { $push: { users: currentUser } }
    );

    res.status(200).send({ message: "Gruppe erfolgreich beigetreten" });
  } catch (error) {
    res.status(500).send({ message: `${error}` });
  }
};

exports.leave = async (req, res, next) => {
  const { currentUser } = req.body;

  try {
    let group = await Group.findOne({ _id: req.params.groupId });
    if (!group) return res.status(400).send({ message: "Invalid Link" });

    group = await Group.updateOne(
      { _id: req.params.groupId },
      { $pull: { users: currentUser } }
    );
    let user = await User.updateOne(
      { _id: currentUser },
      { $pull: { joinedGroups: req.params.groupId } }
    );
    res.status(200).send({ message: "Gruppe erfolgreich verlassen" });
  } catch (error) {
    res.status(500).send({ message: `${error}` });
  }
};

exports.edit = async (req, res, next) => {
  try {
    let group = await Group.findOne({ _id: req.params.groupId });
    if (!group) return res.status(400).send({ message: "Invalid Link" });

    group = await Group.updateOne({ _id: req.params.groupId }, { ...req.body });

    group = await Group.findOne({ _id: req.params.groupId });

    let dateTime = dateTimeForCalender(group.date, group.time, group.length);

    let event = {
      summary: `${group.name}`,
      description: `Join code: ${group._id}`,
      start: {
        dateTime: dateTime["start"],
        timeZone: "Europe/Berlin",
      },
      end: {
        dateTime: dateTime["end"],
        timeZone: "Europe/Berlin",
      },
      recurrence: [`RRULE:FREQ=WEEKLY;INTERVAL=${+group.frequency}`],
    };

    if (group) {
      let updatedEvent = await editEvent(group.meeting, event);
    }

    res.status(200).send({ message: "Gruppe erfolgreich aktualisiert" });
  } catch (error) {
    res.status(500).send({ message: `${error}` });
  }
};

exports.delete = async (req, res, next) => {
  try {
    let group = await Group.findOne({ _id: req.params.groupId });
    if (!group) return res.status(400).send({ message: "Invalid Link" });

    const data = await User.updateMany(
      {
        joinedGroups: {
          $in: [req.params.groupId],
        },
        meetings: {
          $in: [group.meeting],
        },
      },
      {
        $pull: {
          joinedGroups: req.params.groupId,
          meetings: group.meeting,
        },
      }
    );

    await User.updateOne(
      { _id: group.moderator },
      {
        $pull: {
          moderatedGroups: req.params.groupId,
          meetings: group.meeting,
        },
      }
    );

    const user = await User.findOne({ _id: group.moderator });

    if (user.moderatedGroups.length === 0) {
      await User.updateOne({ _id: group.moderator }, { moderator: false });
    }

    await deleteEvent(group.meeting);

    group = await Group.deleteOne({ _id: req.params.groupId });
    res.status(200).send({ message: "Gruppe erfolgreich gelöscht", data });
  } catch (error) {
    res.status(500).send({ message: `${error}` });
  }
};
