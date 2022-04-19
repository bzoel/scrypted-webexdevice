// https://developer.scrypted.app/#getting-started
// package.json contains the metadata (name, interfaces) about this device
// under the "scrypted" key.
import axios from 'axios';
import { HttpRequestHandler, HumiditySensor, ScryptedDeviceBase, TemperatureUnit, Thermometer, HttpRequest, HttpResponse, BinarySensor, OccupancySensor, Settings, Setting, SettingValue } from '@scrypted/sdk';
import sdk from '@scrypted/sdk';
const { log, endpointManager } = sdk;

class WebexDevice extends ScryptedDeviceBase implements Thermometer, HumiditySensor, HttpRequestHandler, BinarySensor, OccupancySensor, Settings {
    constructor() {
        super();

        endpointManager.getInsecurePublicLocalEndpoint().then(endpoint => {
            this.console.log(endpoint);

        })

    }
    async getSettings(): Promise<Setting[]> {
        throw new Error('Method not implemented.');
    }
    
    async putSetting(key: string, value: SettingValue): Promise<void> {
        throw new Error('Method not implemented.');
    }

    async onRequest(request: HttpRequest, response: HttpResponse) {
        response.send('OK');
        
        const json = JSON.parse(request.body)
        this.console.log(json)

        const humidity = json.Status?.RoomAnalytics?.RelativeHumidity
        if (humidity) {
            this.console.log(`Humidity ${humidity}`)
            this.humidity = Number(humidity);
        }

        const temperature = json.Status?.RoomAnalytics?.AmbientTemperature
        if (temperature) {
            this.console.log(`Temperature ${temperature}`)
            this.temperature = Number(temperature);
        }

        
        const callConnect = json.Event?.CallSuccessful
        if (callConnect) {
            this.console.log(`Call connected: ${callConnect}`)
            this.binaryState = true;
        }

        const callDisconnect = json.Event?.CallDisconnect
        if (callDisconnect) {
            this.console.log(`Call disconnected ${callDisconnect}`)
            this.binaryState = false;
        }

        const peoplePresence = json.Status?.RoomAnalytics?.PeoplePresence?.Value
        if (peoplePresence) {
            this.console.log(`People Presence ${peoplePresence}`)

            if (peoplePresence === "Yes")
                this.occupied = true;
            else
                this.occupied = false;
        }
        
        const currentPeopleCount = Number(json.Status?.RoomAnalytics?.PeopleCount?.Current?.Value)
        if (currentPeopleCount) {
            this.console.log(`Current People Count: ${currentPeopleCount}`)
        }
    
    }

    async setTemperatureUnit(temperatureUnit: TemperatureUnit): Promise<void> {
        throw new Error('Method not implemented.');
    }
    
}

export default new WebexDevice();
