const Yup = require("yup");
const zxcvbn = require("zxcvbn");

const isLeapYear = year => {
	if (year % 4 === 0) {
		if (year % 100 !== 0) return true;
		if (year % 400 === 0) return true;
		return false;
	}
	return false;
};

const getMonth = number => {
	return [
		"January",
		"Febuary",
		"March",
		"April",
		"May",
		"June",
		"July",
		"August",
		"September",
		"October",
		"November",
		"December"
	][number - 1];
};

exports.user = Yup.object().shape({
	name: Yup.string().required("is required"),
	email: Yup.string()
		.email("is not valid")
		.required("is required"),
	password: Yup.string()
		.required("is required")
		.test(
			"is-strong-enough",
			"must be at least Medium strength (3 bars).",
			password => password && zxcvbn(password).score >= 2
		),
	date: Yup.object().shape({
		day: Yup.number()
			.integer()
			.min(1, "Select a Day")
			.max(31)
			.when(
				"month",
				(month, schema) =>
					month === 9 || month === 4 || month === 6 || month === 11
						? schema.max(30, `${getMonth(month)} only has 30 days`)
						: schema
			)
			.when(
				["month", "year"],
				(month, year, schema) =>
					month == 2
						? schema.max(
								28,
								`There were only 28 days in February in ${year}`
						  )
						: schema
			)
			.when(
				["year", "month"],
				(year, month, schema) =>
					isLeapYear(year) && month == 2
						? schema.max(
								29,
								`There were only 29 days in February in ${year}`
						  )
						: schema
			).required("Select a Day"),
		month: Yup.number()
			.integer()
			.min(1, "Select a Month")
			.max(12)
			.required("Select a Month"),
		year: Yup.number()
			.integer()
			.min(1905, "Select a Year")
			.max(new Date().getFullYear() - 13)
			.required("Select a Year")
	}),
	gender: Yup.mixed()
		.required("Choose your gender")
		.oneOf(["M", "F"])
});
