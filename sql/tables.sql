BEGIN;

CREATE SEQUENCE IF NOT EXISTS users_id_seq;
CREATE SEQUENCE IF NOT EXISTS hashes_id_seq;
CREATE SEQUENCE IF NOT EXISTS plans_id_seq;
CREATE SEQUENCE IF NOT EXISTS meals_id_seq;
CREATE SEQUENCE IF NOT EXISTS ingredients_id_seq;

CREATE TYPE gender AS ENUM ('M', 'F');

CREATE TABLE IF NOT EXISTS users (
	id 				VARCHAR(10) 	PRIMARY KEY,
	name			VARCHAR(100) 	NOT NULL,
	email			VARCHAR(254) 	NOT NULL UNIQUE,
	dob				DATE 			NOT NULL,
	gender			GENDER 			NOT NULL,
	weight 			SMALLINT,
	activity_level  SMALLINT,		
	active_plan 	VARCHAR(10),
	hashed_password	VARCHAR(60)		NOT NULL,
	verified		BOOLEAN 		NOT NULL,
	created			TIMESTAMPTZ 	NOT NULL,
	modified		TIMESTAMPTZ		NOT NULL
);

CREATE UNIQUE INDEX users_email_index ON users(email);

CREATE TABLE IF NOT EXISTS hashes (
	id 				VARCHAR(10)		PRIMARY KEY,
	hash 			VARCHAR(32)		NOT NULL,
	category		INT 			NOT NULL, -- reset password or verify account
	created			TIMESTAMPTZ 	NOT NULL,
	modified		TIMESTAMPTZ		NOT NULL,
	user_id 		VARCHAR(10) 	NOT NULL REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS plans (
	id 				VARCHAR(10)		PRIMARY KEY,
	name			VARCHAR(100) 	NOT NULL,
	description		TEXT,
	private			BOOLEAN,
	created			TIMESTAMPTZ 	NOT NULL,
	modified		TIMESTAMPTZ		NOT NULL,
	creator_id		VARCHAR(10) 	NOT NULL REFERENCES users(id)
);

CREATE INDEX plans_name_index ON plans(name);
CREATE INDEX plans_creator_index ON plans(creator_id);

ALTER TABLE users ADD CONSTRAINT fk_active_plan FOREIGN KEY (active_plan) REFERENCES plans(id);

CREATE TABLE IF NOT EXISTS saved_plans (
	user_id			VARCHAR(10) 	REFERENCES users(id),
	plan_id 		VARCHAR(10) 	REFERENCES plans(id),
	created			TIMESTAMPTZ 	NOT NULL,
	modified		TIMESTAMPTZ		NOT NULL,
	PRIMARY KEY (user_id, plan_id)
);

CREATE TABLE IF NOT EXISTS meals (
	id 				VARCHAR(10) 	PRIMARY KEY,
	name			VARCHAR(100) 	NOT NULL,
	rating 			SMALLINT,
	description 	TEXT,
	method			TEXT,
	serves 			SMALLINT,  	
	private			BOOLEAN,
	pinned			BOOLEAN			NOT NULL,
	created			TIMESTAMPTZ 	NOT NULL,
	modified		TIMESTAMPTZ		NOT NULL,
	creator_id		VARCHAR(10) 	NOT NULL REFERENCES users(id)
);

CREATE INDEX meals_name_index ON meals(name);
CREATE INDEX meals_creator_index ON meals(creator_id);

CREATE TABLE IF NOT EXISTS saved_meals (
	user_id			VARCHAR(10) 	REFERENCES users(id),
	meal_id			VARCHAR(10) 	REFERENCES meals(id),
	created			TIMESTAMPTZ 	NOT NULL,
	modified		TIMESTAMPTZ		NOT NULL,
	PRIMARY KEY (user_id, meal_id)
);

-- The meals in a plan
CREATE TABLE IF NOT EXISTS plan_compositions (
	plan_id			VARCHAR(10) 	REFERENCES plans(id),
	meal_id			VARCHAR(10) 	REFERENCES meals(id),
	day_otw			SMALLINT 		NOT NULL,
	group_no		INT 			NOT NULL,
	order_no		INT 			NOT NULL,
	amount			INT 			NOT NULL,
	created			TIMESTAMPTZ 	NOT NULL,
	modified		TIMESTAMPTZ		NOT NULL,
	PRIMARY KEY (plan_id, meal_id, group_no, day_otw)
);

CREATE TYPE units AS ENUM ('mL', 'g', 'amount');

CREATE TABLE IF NOT EXISTS ingredients (
	id 				 VARCHAR(10) 	PRIMARY KEY,
	name 			 VARCHAR(100) 	NOT NULL,
	units 			 UNITS 			NOT NULL,
	energy 			 INT 			NOT NULL,
	protein 		 REAL 			NOT NULL,
	fat 			 REAL 			NOT NULL,
	trans 			 REAL,
	saturated 		 REAL			NOT NULL,
	monounsaturated  REAL,
	polyunsaturated  REAL,
	omega_3 		 REAL,
	omega_6 		 REAL,
	omega_9 		 REAL,
	carbohydrates 	 REAL 			NOT NULL,
	sugars 			 REAL			NOT NULL,
	dietary_fiber 	 REAL,
	sodium 			 REAL 			NOT NULL,
	vitamin_C		 REAL,
	calcium			 REAL,
	iron			 REAL,
	vitamin_D		 REAL,
	vitamin_E		 REAL,
	vitamin_K	 	 REAL,
	vitamin_B1		 REAL,
	vitamin_B2		 REAL,
	vitamin_B3		 REAL,
	vitamin_B6		 REAL,
	folate			 REAL,
	vitamin_B12		 REAL,
	biotin	 		 REAL,
	vitamin_B5		 REAL,
	phosphorus  	 REAL,
	iodine  		 REAL,
	magnesium  		 REAL,
	zinc  			 REAL,
	selenium  		 REAL,
	copper  		 REAL,
	manganese  		 REAL,
	chromium 		 REAL,
	molybdenum 		 REAL,
	chloride 	 	 REAL,
	created			 TIMESTAMPTZ 	NOT NULL,
	modified		 TIMESTAMPTZ 	NOT NULL
);

CREATE INDEX ingredients_name_index ON ingredients(name);

CREATE TYPE measurement AS ENUM ('mL', 'g', 'amount', 'teaspoon', 'tablespoon', 'cup');

-- The inredients in a meal
CREATE TABLE IF NOT EXISTS meal_compositions (
	meal_id			VARCHAR(10) 	REFERENCES meals(id),
	ingredient_id	VARCHAR(10) 	REFERENCES ingredients(id),
	order_no		INT 			NOT NULL,
	amount			REAL 			NOT NULL,
	description		VARCHAR(100),
	measurement     MEASUREMENT		NOT NULL,
	created			TIMESTAMPTZ 	NOT NULL,
	modified		TIMESTAMPTZ		NOT NULL,
	PRIMARY KEY (meal_id, ingredient_id)
);

COMMIT;
