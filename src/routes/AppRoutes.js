const Router = require("koa-router");
const router = new Router();

router.get("/ingredients", async ctx => {
	console.log("session", ctx.session);
	if (!ctx.query.q) {
		ctx.response.body = { rows: [] };
		return;
	}
	const result = await ctx.queryDatabase(
		"SELECT * FROM ingredients WHERE LOWER(name) LIKE %L",
		`${ctx.query.q.toLowerCase()}%`
	);
	ctx.response.body = result.rows;
});

router.get("/meals", async ctx => {
	const result = await ctx.queryDatabase("\
		SELECT meals.id AS meal_id, meals.name AS meal_name,\
		ingredients.id, ingredients.name, order_no, \
		amount, ingredients.units, energy, protein, fat, dietary_fiber, meal_compositions.description, serves, pinned\
		FROM users, meals, meal_compositions, ingredients \
		WHERE users.id = %L\
		AND users.id = meals.creator_id \
		AND meals.id = meal_compositions.meal_id \
		AND ingredients.id = meal_compositions.ingredient_id \
		ORDER BY pinned, meals.id, meal_compositions.order_no;", ctx.session.id);

	const meals = {};
	const allIngredients = {};
	result.rows.forEach(row => {
		const { meal_id, meal_name, id, name, order_no, amount, units, energy, protein, fat, dietary_fiber, description, serves, pinned } = row;
		if (!(meal_id in meals)) {
			meals[meal_id] = {
				meal_id,
				meal_name,
				serves,
				pinned,
				totalEnergy: 0,
				totalProtein: 0,
				totalFat: 0,
				totalDietaryFiber: 0,
				ingredients: []
			}
		}
		const meal = meals[meal_id];
		const factor = amount/100;
		meal.ingredients.push({ id, order_no, amount, units, description });
		meal.totalEnergy += energy*factor; 
		meal.totalProtein += protein*factor;
		meal.totalFat += fat*factor;
		meal.totalDietaryFiber += dietary_fiber*factor;
		if (!(id in allIngredients)) allIngredients[id] = { id, name, energy, protein, fat };
	});
	ctx.response.body = { meals, allIngredients };
});

module.exports = router.routes();
