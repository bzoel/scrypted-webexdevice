/*
 *  Scrypted plugin for Cisco Webex Device
 *
 */
import { HttpRequestHandler, HumiditySensor, ScryptedDeviceBase, TemperatureUnit, Thermometer, HttpRequest, HttpResponse, BinarySensor, OccupancySensor, Settings, Setting, SettingValue, Refresh, DeviceInformation } from '@scrypted/sdk';
import sdk from '@scrypted/sdk';
const { log, endpointManager } = sdk;
const jsxapi = require('jsxapi');

const FEEDBACK_SLOT = 2;

class WebexDevice extends ScryptedDeviceBase implements Thermometer, HumiditySensor, HttpRequestHandler, BinarySensor, OccupancySensor, Settings, Refresh {    
    xapi: typeof jsxapi
    httpEndpoint: string
    
    constructor() {
        super();
        this.temperatureUnit = TemperatureUnit.C;
        this.xapi = undefined;

        endpointManager.getInsecurePublicLocalEndpoint().then(endpoint => {
            this.httpEndpoint = endpoint.replace("127.0.0.1", this.storage.getItem('scrypted_server_ip'));
            this.connectXAPI();
        })

    }

    connectXAPI() {
        jsxapi
        .connect(`wss://${this.storage.getItem('device_ip')}`, {
            username: this.storage.getItem('device_username'),
            password: this.storage.getItem('device_password'),
        })
        .on('error', this.console.error)
        .on('ready', async (xapi) => {
            this.xapi = xapi;
            this.console.log(`Connected to xapi of ${this.storage.getItem('device_ip')}`)

            // Register HttpFeedback
            this.xapi.Command.HttpFeedback.Register({
                Expression: [
                    "/Event/CallSuccessful",
                    "/Event/CallDisconnect",
                    "/Status/RoomAnalytics/PeoplePresence",
                    "/Status/RoomAnalytics/PeopleCount",
                ],
                FeedbackSlot: FEEDBACK_SLOT,
                Format: "json",
                ServerUrl: this.httpEndpoint
            });

            this.xapi.Status.SystemUnit
                .get()
                .then((SystemUnit) => {
                    this.info = {
                        manufacturer: SystemUnit.ProductType,
                        model: SystemUnit.ProductId,
                        serialNumber: SystemUnit.Hardware.Module.SerialNumber,
                        firmware: (SystemUnit.Software.Version).replace("ce", ""),
                    }
                })

        });
    }

    disconnectXAPI() {
        this.xapi.Command.HttpFeedback.Deregister(
            { FeedbackSlot: FEEDBACK_SLOT });
        this.xapi.close();
        this.xapi = undefined;
    }

    async getRefreshFrequency(): Promise<number> {
        return 60;
    }

    async refresh(refreshInterface: string, userInitiated: boolean): Promise<void> {
        this.console.log(`${refreshInterface} requested refresh: ${new Date()}`);

        this.xapi.Status.RoomAnalytics
            .get()
            .then((RoomAnalytics) => {
                this.console.log(`Temperature ${RoomAnalytics.AmbientTemperature}, Humidity ${RoomAnalytics.RelativeHumidity}, PeoplePresence ${RoomAnalytics.PeoplePresence}, PeopleCount ${RoomAnalytics.PeopleCount}`);
                
                this.temperature = RoomAnalytics.AmbientTemperature;
                this.humidity = RoomAnalytics.RelativeHumidity;
                this.occupied = (RoomAnalytics.PeoplePresence === "Yes");
            })

    }

    async getSettings(): Promise<Setting[]> {
        return [
            {
                title: "Device IP",
                key: "device_ip",
                value: this.storage.getItem("device_ip"),
                description: "IP of Webex Device"
            },
            {
                title: "Username",
                key: "device_username",
                value: this.storage.getItem("device_username"),
                description: "Username on Webex device"
            },
            {
                title: "Password",
                key: "device_password",
                value: this.storage.getItem("device_password"),
                description: "Password on Webex device"
            },
            {
                title: "Scrypted Server IP",
                key: "scrypted_server_ip",
                value: this.storage.getItem("scrypted_server_ip"),
                description: "IP of the Scrypted server"
            }
        ]
    }

    async putSetting(key: string, value: SettingValue): Promise<void> {
        this.storage.setItem(key, value.toString());
    }

    async onRequest(request: HttpRequest, response: HttpResponse) {
        response.send('OK');
        
        const json = JSON.parse(request.body)
        this.console.log(json)

        const callConnect = json.Event?.CallSuccessful
        if (callConnect) {
            this.console.log('Call connected')
            this.console.log(callConnect)
            this.binaryState = true;
        }

        const callDisconnect = json.Event?.CallDisconnect
        if (callDisconnect) {
            this.console.log('Call disconnected')
            this.console.log(callDisconnect)
            this.binaryState = false;
        }

        const peoplePresence = json.Status?.RoomAnalytics?.PeoplePresence?.Value
        if (peoplePresence) {
            this.console.log(`People Presence ${peoplePresence}`)
            this.occupied = (peoplePresence === "Yes")
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
