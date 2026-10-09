.PHONY: build build-ClientsFunction build-VehiclesFunction build-AppointmentsFunction build-HealthFunction

build: build-ClientsFunction build-VehiclesFunction build-AppointmentsFunction build-HealthFunction

# Each Lambda compiles a self-contained esbuild bundle (all dependencies
# inlined), so only its handler is published to the artifact directory.

build-ClientsFunction:
	npm run build:clients
	mkdir -p $(ARTIFACTS_DIR)/handlers
	cp dist/handlers/clientsHandler.js $(ARTIFACTS_DIR)/handlers/clientsHandler.js

build-VehiclesFunction:
	npm run build:vehicles
	mkdir -p $(ARTIFACTS_DIR)/handlers
	cp dist/handlers/vehiclesHandler.js $(ARTIFACTS_DIR)/handlers/vehiclesHandler.js

build-AppointmentsFunction:
	npm run build:appointments
	mkdir -p $(ARTIFACTS_DIR)/handlers
	cp dist/handlers/appointmentsHandler.js $(ARTIFACTS_DIR)/handlers/appointmentsHandler.js

build-HealthFunction:
	npm run build:health
	mkdir -p $(ARTIFACTS_DIR)/handlers
	cp dist/handlers/healthHandler.js $(ARTIFACTS_DIR)/handlers/healthHandler.js