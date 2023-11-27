const { Group } = require('../models/Group.model')
const { User } = require('../models/User.model')

const myCustomError = require('../utils/myCustomError')
// const generateRoom = require("../utils/videoSDK");

const {
	dateTimeForCalender,
	insertEvent,
	getEvents,
	getEvent,
	deleteEvent,
	editEvent,
} = require('../utils/googleCalendar')

exports.createMeeting = async (req, res, next) => {
	const {
		meetingParameters: { frequency, date, time, length },
		user,
		group,
		// token
	} = res.locals

	try {
		if (!res.locals)
			next(myCustomError('Something went wrong with setting locals', 500))

		const dateTime = dateTimeForCalender(date, time, length)

		const meeting = {
			summary: group.name,
			description: `Join code: ${group._id}`,
			start: {
				dateTime: dateTime['start'],
				timeZone: 'Europe/Berlin',
			},
			end: {
				dateTime: dateTime['end'],
				timeZone: 'Europe/Berlin',
			},
			recurrence: [`RRULE:FREQ=WEEKLY;COUNT=2;INTERVAL=${+frequency}`],
		}
		const newMeeting = await insertEvent(meeting)

		await User.updateOne(
			{ _id: user._id },
			{ $push: { moderatedGroups: group._id, meetings: newMeeting.id } }
		)

		await Group.updateOne(
			{ _id: group._id },
			{ $push: { meetings: newMeeting.id }, moderatorId: user._id }
		)

		// generateRoom(token, group._id, length);

		res.send({ message: 'all good here, boss' })
	} catch (error) {
		next(error)
	}
}

exports.editMeeting = async (req, res, next) => {
	const {
		params: { meetingId, groupId },
		body: { date, time, length, frequency },
	} = req

	try {
		const dateTime = dateTimeForCalender(date, time, length)

		const group = await Group.findOne({ _id: groupId })
		if (!group) throw myCustomError('Group could not be found', 400)

		const meeting = {
			summary: group.name,
			description: `Join code: ${group._id}`,
			start: {
				dateTime: dateTime['start'],
				timeZone: 'Europe/Berlin',
			},
			end: {
				dateTime: dateTime['end'],
				timeZone: 'Europe/Berlin',
			},
			recurrence: [`RRULE:FREQ=WEEKLY;COUNT=2;INTERVAL=${+frequency}`],
		}

		const editedMeeting = await editEvent(meetingId, meeting)

		res.send(editedMeeting)
	} catch (error) {
		next(error)
	}
}

exports.deleteMeeting = async (req, res, next) => {
	const { meetingId, groupId } = req.params

	try {
		const group = await Group.findOne({ _id: groupId })
		if (group.meetings.length === 1) throw myCustomError('Group must have at least one meeting', 400)

		await User.updateMany(
			{
				meetings: {
					$in: [meetingId],
				},
			},
			{
				$pull: {
					meetings: meetingId,
				},
			}
		)

		await Group.updateOne(
			{ _id: groupId },
			{
				$pull: {
					meetings: meetingId,
				},
			}
		)

		await deleteEvent(meetingId)

		res.send({ message: 'Termin erfolgreich gelöscht' })

	} catch (error) {
		next(error)
	}
}
