const { Pool } = require("pg");
const escape = require("pg-escape"); // Escape SQL statements

const db = new Pool({
	user: "andrew",
	host: "localhost",
	database: "nutrition",
	password: "",
	port: 5432
});

module.exports = async function(query, ...rest) {
	const args =
		arguments.length === 1 ? [arguments[0]] : Array.apply(null, arguments);
	console.log(args);
	console.log(escape.apply(null, args));
	return await db.query(escape.apply(null, args));
};
