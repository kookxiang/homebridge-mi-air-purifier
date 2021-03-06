var miio = require('miio');
var Service, Characteristic;
var devices = [];

module.exports = function (homebridge) {
	Service = homebridge.hap.Service;
	Characteristic = homebridge.hap.Characteristic;

	homebridge.registerAccessory('homebridge-mi-air-purifier', 'MiAirPurifier', MiAirPurifier);
}

function MiAirPurifier(log, config) {
	this.log = log;
	this.ip = config.ip;
	this.token = config.token;
	this.name = config.name || 'Air Purifier';
	this.showAirQuality = config.showAirQuality || false;
	this.showTemperature = config.showTemperature || false;
	this.showHumidity = config.showTemperature || false;
	this.maxFanSpeed = (config.maxFanSpeed || 16) / 100;

	this.services = [];

	if (!this.ip)
		throw new Error('Your must provide IP address of the Air Purifier.');

	if (!this.token)
		throw new Error('Your must provide token of the Air Purifier.');

	// Register the service
	this.service = new Service.AirPurifier(this.name);

	this.service
		.getCharacteristic(Characteristic.Active)
		.on('get', this.getActive.bind(this))
		.on('set', this.setActive.bind(this));

	this.service
		.getCharacteristic(Characteristic.CurrentAirPurifierState)
		.on('get', this.getCurrentAirPurifierState.bind(this));

	this.service
		.getCharacteristic(Characteristic.TargetAirPurifierState)
		.on('get', this.getTargetAirPurifierState.bind(this))
		.on('set', this.setTargetAirPurifierState.bind(this));

	this.service
		.getCharacteristic(Characteristic.LockPhysicalControls)
		.on('get', this.getLockPhysicalControls.bind(this))
		.on('set', this.setLockPhysicalControls.bind(this));

	this.service
		.getCharacteristic(Characteristic.RotationSpeed)
		.on('get', this.getRotationSpeed.bind(this))
		.on('set', this.setRotationSpeed.bind(this));

	// Service information
	this.serviceInfo = new Service.AccessoryInformation();

	this.serviceInfo
		.setCharacteristic(Characteristic.Manufacturer, 'Xiaomi')
		.setCharacteristic(Characteristic.Model, 'Air Purifier')
		.setCharacteristic(Characteristic.SerialNumber, '0799-E5C0-57A641308C0D');

	this.services.push(this.service);
	this.services.push(this.serviceInfo);

	if (this.showAirQuality) {
		this.airQualitySensorService = new Service.AirQualitySensor('Air Quality');

		this.airQualitySensorService
			.getCharacteristic(Characteristic.AirQuality)
			.on('get', this.getAirQuality.bind(this));

		this.services.push(this.airQualitySensorService);
	}

	if (this.showTemperature) {
		this.temperatureSensorService = new Service.TemperatureSensor('Temperature');

		this.temperatureSensorService
			.getCharacteristic(Characteristic.CurrentTemperature)
			.on('get', this.getCurrentTemperature.bind(this));

		this.services.push(this.temperatureSensorService);
	}

	if (this.showHumidity) {
		this.humiditySensorService = new Service.HumiditySensor('Humidity');

		this.humiditySensorService
			.getCharacteristic(Characteristic.CurrentRelativeHumidity)
			.on('get', this.getCurrentRelativeHumidity.bind(this));

		this.services.push(this.humiditySensorService);
	}

	this.discover();
}

MiAirPurifier.prototype = {
	discover: function () {
		this.device = new miio.Device({
			address: this.ip,
			token: this.token
		});
	},

	getActive: function (callback) {
		this.device.call('get_prop', ['mode'])
			.then(result => {
				callback(null, (result[0] === 'idle') ? Characteristic.Active.INACTIVE : Characteristic.Active.ACTIVE);
			}).catch(callback);
	},

	setActive: function (state, callback) {
		this.device.call('set_power', [(state) ? 'on' : 'off'])
			.then(result => {
				(result[0] === 'ok') ? callback() : callback(new Error(result[0]));
			})
			.catch(callback);
	},

	getCurrentAirPurifierState: function (callback) {
		this.device.call('get_prop', ['mode'])
			.then(result => {
				callback(null, (result[0] === 'idle') ? Characteristic.CurrentAirPurifierState.INACTIVE : Characteristic.CurrentAirPurifierState.PURIFYING_AIR);
			}).catch(callback);
	},

	getTargetAirPurifierState: function (callback) {
		this.device.call('get_prop', ['mode'])
			.then(result => {
				callback(null, (result[0] === 'favorite') ? Characteristic.TargetAirPurifierState.MANUAL : Characteristic.TargetAirPurifierState.AUTO);
			}).catch(callback);
	},

	setTargetAirPurifierState: function (state, callback) {
		this.device.call('set_mode', [(state) ? 'auto' : 'favorite'])
			.then(result => {
				(result[0] === 'ok') ? callback() : callback(new Error(result[0]));
			})
			.catch(callback);
	},

	getLockPhysicalControls: function (callback) {
		this.device.call('get_prop', ['child_lock'])
			.then(result => {
				callback(null, result[0] === 'on' ? Characteristic.LockPhysicalControls.CONTROL_LOCK_ENABLED : Characteristic.LockPhysicalControls.CONTROL_LOCK_DISABLED);
			})
			.catch(callback);
	},

	setLockPhysicalControls: function (state, callback) {
		this.device.call('set_child_lock', [(state) ? 'on' : 'off'])
			.then(result => {
				(result[0] === 'ok') ? callback() : callback(new Error(result[0]));
			}).catch(callback);
	},

	getCurrentRelativeHumidity: function (callback) {
		this.device.call('get_prop', ['humidity'])
			.then(result => {
				callback(null, result[0]);
			}).catch(callback);
	},

	getRotationSpeed: function (callback) {
		this.device.call('get_prop', ['favorite_level'])
			.then(result => {
				callback(null, Math.min(100, Math.round(result[0] / this.maxFanSpeed)));
			}).catch(callback);
	},

	setRotationSpeed: function (speed, callback) {
		// Note: if this doesn't work, try to use "set_favorite_level" (different firmware version)
		this.device.call('set_level_favorite', [Math.round(speed * this.maxFanSpeed)])
			.then(result => {
				(result[0] === 'ok') ? callback() : callback(new Error(result[0]));
			}).catch(callback);
	},

	getAirQuality: function (callback) {
		var levels = [
			[200, Characteristic.AirQuality.POOR],
			[150, Characteristic.AirQuality.INFERIOR],
			[100, Characteristic.AirQuality.FAIR],
			[50, Characteristic.AirQuality.GOOD],
			[0, Characteristic.AirQuality.EXCELLENT],
		];

		this.device.call('get_prop', ['aqi'])
			.then(result => {
				for (var item of levels) {
					if (result[0] >= item[0]) {
						callback(null, item[1]);
						return;
					}
				}
			}).catch(callback);
	},

	getCurrentTemperature: function (callback) {
		this.device.call('get_prop', ['temp_dec'])
			.then(result => {
				callback(null, result[0] / 10.0);
			})
			.catch(callback);
	},

	identify: function (callback) {
		callback();
	},

	getServices: function () {
		return this.services;
	}
};
