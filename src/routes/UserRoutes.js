const Router = require("koa-router");
const router = new Router();
const queryDatabase = require("../Database");
const secret = require("../Secret");

const schema = require("../ValidationSchema");
const mail = require("../Mail");
const bcrypt = require("bcrypt"); // Check password match
const axios = require("axios");

const sendMail = mail.createSender({
	from: "NutritionTrackr <verify@nutritiontrackr.app>",
	transport: {
		pool: true,
		host: "smtp.zoho.com",
		port: 465,
		secure: true,
		auth: {
			user: "verify@nutritiontrackr.app",
			pass: secret.mailPass
		}
	}
});

const generateHash = async (category, userID) => {
	const hash = await queryDatabase(
		"INSERT INTO hashes(category, user_id) VALUES(%s, %L) RETURNING id AS hashid, hash",
		category,
		userID
	);
	return hash.rows[0];
};

const getHash = async (category, userID, hashID, hashValue) => {
	const hash = await queryDatabase(
		"SELECT id FROM hashes WHERE id=%L AND user_id=%L AND category=%s AND hash=%L",
		hashID,
		userID,
		category,
		hashValue
	);
	return hash.rowCount === 1 ? hash.rows[0] : null;
};

const deleteHash = async id =>
	await queryDatabase("DELETE FROM hashes WHERE id=%L", id);

const updatePassword = async (id, password) =>
	await queryDatabase(
		"UPDATE users SET hashed_password=%L WHERE id=%L",
		password,
		id
	);

const confirmRecaptcha = async recaptcha => {
	if (recaptcha) {
		const response = await axios.post(
			`https://www.google.com/recaptcha/api/siteverify?secret=6LeYL1cUAAAAAFJVtyG1jyvABzrTHMHnlxOpi_h5&response=${recaptcha}`
		);

		console.log(response.config.data, response.data);

		if (!response.data.success) {
			return -1;
		}
	} else {
		return -1;
	}
}

router.post("/newpassword", async ctx => {
	const { id, hashID, hash, newPassword } = ctx.request.body;
	const hashEntry = await getHash(1, id, hashID, hash);
	if (hashEntry !== null) {
		await deleteHash(hashEntry.id);
		await updatePassword(id, newPassword);
		ctx.body = { status: "updated" };
	} else {
		ctx.throw(404, "Invalid");
	}
});

router.post("/requestreset", async ctx => {
	const { email, recaptcha } = ctx.request.body;
	console.log(recaptcha);
	await confirmRecaptcha(recaptcha);

	const user = await ctx.queryDatabase(
		"SELECT id FROM users WHERE email=%L",
		email
	);
	const { id } = user.rows[0];

	if (user.rows[0]) {
		const existingHash = await ctx.queryDatabase(
			"SELECT id AS oldHashID FROM hashes WHERE user_id=%L AND category=1",
			id
		);
		console.log(existingHash);

		// update instead of delete
		let hashEntry;
		if (existingHash.rows[0]) {
			const result = (hashEntry = await ctx.queryDatabase(
				"UPDATE hashes SET hash=gen_hash() WHERE id=%L RETURNING id AS hashid, hash",
				existingHash.rows[0].oldhashid
			));
			hashEntry = result.rows[0];
		} else {
			hashEntry = await generateHash(1, id);
		}
		const { hashid, hash } = hashEntry;
		const info = await sendMail("reset", email, id, hashid, hash);
	}
	ctx.body = { sent: true };
});

router.post("/signup", async ctx => {
	let userForm = ctx.request.body;
	if (!userForm) return;

	await confirmRecaptcha(userForm.recaptcha);
	userForm = await schema.user.validate(userForm);

	let { name, email, password, date, gender } = userForm;
	const { day, month, year } = date;
	const dob = `${year}-${month}-${day}`;

	const registered = await mail.registered(email);
	if (!registered) {
		const user = await ctx.queryDatabase(
			"INSERT INTO users(name, email, hashed_password, dob, gender) \
					VALUES(%L,%L,%L,%L,%L) \
					RETURNING email, id;",
			name,
			email,
			password,
			dob,
			gender
		);

		let { id, email: transformedEmail } = user.rows[0];

		const hashEntry = await generateHash(0, id);
		const { hashid, hash } = hashEntry;

		await sendMail("verify", email, id, hashid, hash);
		ctx.response.body = {
			id,
			hashid,
			email: transformedEmail,
			verify_hash: hash
		};
	} else {
		ctx.throw(409, "Email already exists", { code: 1 });
	}
});

router.get("/resend/:id/:hashID", async ctx => {
	const { id, hashID } = ctx.params;
	console.log(ctx.query);

	const result = await ctx.queryDatabase(
		"SELECT verified, email FROM users WHERE id=%L",
		id
	);

	const { verified, email } = result.rows[0];
	if (verified) {
		ctx.body = { verified: true };
	} else {
		let { requestTime } = ctx.session;

		const firstRequest = requestTime == undefined;
		const timeSinceLastRequest = Date.now() - requestTime;

		if (firstRequest || timeSinceLastRequest >= 60000) {
			ctx.session.requestTime = Date.now();
		} else if (timeSinceLastRequest < 60000) {
			ctx.body = "Stop it";
			return;
		}

		const update = await ctx.queryDatabase(
			"UPDATE hashes SET hash=gen_hash() \
			WHERE id=%L AND user_id=%L RETURNING hash",
			hashID,
			id
		);
		const { hash } = update.rows[0];
		await sendMail("verify", email, id, hashID, hash);
		ctx.body = { status: "sent" };
	}
});

router.get("/verify/:id/:hashID/:hash", async ctx => {
	const { id, hashID, hash } = ctx.params;

	const result = await ctx.queryDatabase(
		"SELECT users.verified \
		FROM users INNER JOIN hashes ON (users.id = hashes.user_id) \
		WHERE hashes.id=%L AND hashes.hash=%L AND hashes.user_id=%L ",
		hashID,
		hash,
		id
	);

	if (result.rowCount == 1) {
		const { verified } = result.rows[0];
		if (!verified) {
			const update = await ctx.queryDatabase(
				"UPDATE users SET verified=TRUE WHERE id=%L RETURNING name, email, dob, gender, weight, activity_level",
				id
			);
			await ctx.queryDatabase("DELETE FROM hashes WHERE id=%L", hashID);
			const {
				name,
				email,
				dob,
				gender,
				weight,
				activity_level
			} = update.rows[0];
			ctx.body = {
				id,
				loggedIn: true,
				name,
				email,
				dob,
				gender,
				weight,
				activity_level
			};
			ctx.session.id = id;
		} else {
			// shouldn't ever get here
			ctx.body = "Already verified";
		}
	} else {
		ctx.throw(404, "Invalid");
	}
});

router.put("/userDetails", async ctx => {
	const modifiable = [
		"name",
		"email",
		"dob",
		"gender",
		"weight",
		"activity_level"
	];

	const typeToFormat = { string: "%L", number: "%s" }

	const id = ctx.session.id;
	const updates = ctx.request.body;

	const entries = Object.entries(updates).map(entry => {
		const key = entry[0];
		if (!modifiable.includes(key)) ctx.throw("cannot update values");
		const value =  entry[1];
		const type = typeof value;
		const format = typeToFormat[type];

		return { key, value, format }
	});

	const setAssignments = entries.map(entry => `${entry.key}=${entry.format}`).join(", ");
	const returningColumns = Array(entries.length).fill("%s").join(", ");

	const keys = entries.map(entry => entry.key);
	const values = entries.map(entry => entry.value);

	const user = await ctx.queryDatabase(
		`UPDATE users SET ${setAssignments} 
		WHERE id=%L RETURNING ${returningColumns}`,
		...values,
		id,
		...keys
	);
	
	console.log(user);

	ctx.response.body = { weight, activity_level } = user.rows[0];
});

router.post("/login", async ctx => {
	// Check inputs exist
	let { email: submittedEmail, password } = ctx.request.body;
	if (!submittedEmail || !password) {
		ctx.response.body = { error: "The email or password was empty" };
		ctx.throw(400, "The email or password was empty");
	}

	// Check email is correct
	const user = await ctx.queryDatabase(
		"SELECT id, verified, name, email, hashed_password, dob, gender, weight, activity_level FROM users WHERE email=%L",
		submittedEmail
	);
	if (user.rows.length === 0) {
		ctx.response.body = { error: "Incorrect email or password" };
		ctx.throw(400, "Incorrect email or password", { code: 2 });
	}

	const {
		id,
		email,
		hashed_password,
		name,
		verified,
		dob,
		gender,
		weight,
		activity_level
	} = user.rows[0];
	// Check password is correct
	const match = await bcrypt.compare(password, hashed_password);
	if (!match) {
		ctx.response.body = { error: "Incorrect email or password" };
		ctx.throw(400, "Incorrect email or password", { code: 2 });
	}

	console.log("verified", verified);
	// check user is verified
	if (verified === false) {
		const hashID = await ctx.queryDatabase(
			"SELECT id FROM hashes WHERE user_id=%L AND category=0",
			id
		);
		ctx.body = {
			id,
			email,
			hashID: hashID.rows[0].id,
			verified: false
		};
	} else {
		ctx.session.id = id;
		ctx.response.body = {
			id,
			loggedIn: true,
			name,
			email,
			dob,
			gender,
			weight,
			activity_level
		};
		console.log(ctx.response.body);
		console.log(ctx.session);
		console.log("logged in");
	}
});

router.get("/logout", async ctx => {
	ctx.session = null;
	ctx.response.body = "Logged out";
	console.log("logged out");
});

module.exports = router.routes();
