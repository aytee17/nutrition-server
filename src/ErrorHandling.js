module.exports = async (ctx, next) => {
	try {
		await next();
	} catch (error) {
		console.log(error);
		const { status, code, message } = error;
		ctx.response.status = error.status || 500;
		ctx.response.body =
			ctx.response.status == 500
				? { message: "Something went wrong" }
				: { code, message };
		//ctx.app.emit('error', err, ctx);
	}
};
