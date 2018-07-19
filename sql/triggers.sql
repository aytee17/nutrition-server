BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_hashids;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

--- Generate a unique id
CREATE OR REPLACE FUNCTION generate_id(seq TEXT)
RETURNS VARCHAR(10) AS $$
DECLARE
	epoch 	BIGINT			:= 1514864017;
	now		BIGINT;
	id 		VARCHAR(10);
BEGIN
	SELECT FLOOR(EXTRACT(EPOCH FROM clock_timestamp())) INTO now;
	now := now - epoch + nextval(seq);
	SELECT id_encode(now, seq, 10) INTO id;
	RETURN id;
END;
$$ LANGUAGE PLPGSQL;

CREATE OR REPLACE FUNCTION process_id_for_insert()
RETURNS TRIGGER AS $$
BEGIN 
	NEW.id = generate_id(TG_ARGV[0] || '_id_seq');
	RETURN NEW;
END;
$$ LANGUAGE PLPGSQL;

CREATE OR REPLACE FUNCTION create_id_triggers()
RETURNS VOID AS $$
DECLARE
	list_tables 	TEXT[] := ARRAY['users', 'hashes', 'plans', 'meals', 'ingredients'];
	triggerName 	TEXT;
	tablename 		TEXT;
BEGIN
	FOREACH tableName IN ARRAY list_tables LOOP
		triggerName = 'generate_id_for_' || tablename;
		EXECUTE format('
			CREATE TRIGGER %I
			BEFORE INSERT ON %I
			FOR EACH ROW EXECUTE PROCEDURE process_id_for_insert(%2$I)
		', triggerName, tableName);
	END LOOP;
END;
$$ LANGUAGE PLPGSQL;

SELECT create_id_triggers();

CREATE OR REPLACE FUNCTION process_user()
RETURNS TRIGGER AS $$
BEGIN
	NEW.email 		:= lower(NEW.email);
	NEW.hashed_password	:= crypt(NEW.hashed_password, gen_salt('bf', 8));
	NEW.verified 	:= false;
	RETURN NEW;
END;
$$ LANGUAGE PLPGSQL;

CREATE TRIGGER user_created
BEFORE INSERT ON users
FOR EACH ROW EXECUTE PROCEDURE process_user();

CREATE OR REPLACE FUNCTION encrypt_password()
RETURNS TRIGGER AS $$
BEGIN
	NEW.hashed_password	:= crypt(NEW.hashed_password, gen_salt('bf', 8));
	RETURN NEW;
END;
$$ LANGUAGE PLPGSQL;

CREATE TRIGGER password_updated
BEFORE UPDATE OF hashed_password ON users
FOR EACH ROW EXECUTE PROCEDURE encrypt_password();

CREATE OR REPLACE FUNCTION gen_hash()
RETURNS VARCHAR(32) AS $$
BEGIN
	RETURN encode(digest(gen_salt('md5'), 'md5'), 'hex');
END;
$$ LANGUAGE PLPGSQL;

CREATE OR REPLACE FUNCTION process_hash()
RETURNS TRIGGER AS $$
BEGIN
	NEW.hash 		:= gen_hash();
	RETURN NEW;
END;
$$ LANGUAGE PLPGSQL;

CREATE TRIGGER hash_created
BEFORE INSERT ON hashes
FOR EACH ROW EXECUTE PROCEDURE process_hash();

-- Insert created timestamp on insert
CREATE OR REPLACE FUNCTION process_ts_for_insert()	
RETURNS TRIGGER AS $$
DECLARE
	currentTime TIMESTAMPTZ := now();
BEGIN
	NEW.created 	:= currentTime;
    NEW.modified 	:= currentTime;
    RETURN NEW;
END;
$$ LANGUAGE PLPGSQL;

-- Update modified timestamp on update
CREATE OR REPLACE FUNCTION process_ts_for_update()	
RETURNS TRIGGER AS $$
BEGIN
    NEW.modified = now();
    RETURN NEW;	
END;
$$ LANGUAGE PLPGSQL;

-- Create triggers for updating and inserting timestamps 
CREATE OR REPLACE FUNCTION create_ts_triggers()
RETURNS VOID AS $$
DECLARE
	list_tables	CURSOR FOR
	    SELECT 	tablename
	    FROM 	pg_tables
	    WHERE 	schemaname = 'public';

    triggerName TEXT;
    tableName	TEXT;
BEGIN
	FOR r IN list_tables LOOP
		tableName 	:= r.tablename;
		triggerName := tableName || '_insert_created_ts';

		EXECUTE format('
			CREATE TRIGGER %I
			BEFORE INSERT ON %I
			FOR EACH ROW EXECUTE PROCEDURE process_ts_for_insert()
		', triggerName, tableName);

		triggerName := tableName || '_update_modified_ts';

		EXECUTE format('
			CREATE TRIGGER %I
			BEFORE UPDATE ON %I
			FOR EACH ROW EXECUTE PROCEDURE process_ts_for_update()
		', triggerName, tableName);
	END LOOP;
END;
$$ LANGUAGE PLPGSQL;

SELECT create_ts_triggers();

COMMIT;
