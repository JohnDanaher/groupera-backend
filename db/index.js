// ℹ️ package responsible to make the connection with mongodb
// https://www.npmjs.com/package/mongoose
const mongoose = require('mongoose')

// ℹ️ Sets the MongoDB URI for our app to have access to it.
// If no env has been set, we dynamically set it to whatever the folder name was upon the creation of the app

const MONGO_URI = process.env.DB_CLUSTER

const connectDatabase = async () => {
	try {
		mongoose.set('useNewUrlParser', true)

		await mongoose.connect(MONGO_URI)

		console.log('connected to database')
	} catch (error) {
		console.log(error)
		process.exit(1)
	}
}

connectDatabase()
