const Koa = require("koa");
const app = new Koa();
const secret = require("./Secret");
app.context.queryDatabase = require("./Database");
app.keys = [secret.key];

// Middleware
const errorHandling = require("./ErrorHandling");
const responseTime = require("koa-response-time");
const bodyParser = require("koa-bodyparser");
const session = require("koa-session");
const cors = require("koa-cors");

// Routes
const userRoutes = require("./routes/UserRoutes.js");
const appRoutes = require("./routes/AppRoutes.js");

app.use(errorHandling);
app.use(responseTime());

app.use(
	cors({
		origin: "http://localhost:8080",
		credentials: true
	})
);

app.use(session(app));
app.use(bodyParser());

app.use(userRoutes);

// auth middleware
app.use(async (ctx, next) => {
	const { id } = ctx.session;
	if (id) {
		await next();
	} else {
		ctx.throw();
	}
});

app.use(appRoutes);

app.listen(3000);
console.log("Listening");
