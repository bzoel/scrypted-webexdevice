/*
 *  Scrypted plugin for Cisco Webex Device
 *
 */
import { HttpRequestHandler, HumiditySensor, ScryptedDeviceBase, TemperatureUnit, Thermometer, HttpRequest, HttpResponse, BinarySensor, OccupancySensor, Settings, Setting, SettingValue, Refresh, DeviceInformation } from '@scrypted/sdk';
import sdk from '@scrypted/sdk';
const { endpointManager } = sdk;
const jsxapi = require('jsxapi');

const FEEDBACK_SLOT = 2;

class WebexDevice extends ScryptedDeviceBase implements Thermometer, HumiditySensor, HttpRequestHandler, BinarySensor, OccupancySensor, Settings, Refresh {    
    xapi: typeof jsxapi
    
    constructor() {
        super();
        this.temperatureUnit = TemperatureUnit.C;
        this.xapi = undefined;

        this.connectXAPI();
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

            const httpEndpoint = await endpointManager?.getInsecurePublicLocalEndpoint()
            this.console.log(`Requesting HttpFeedback to '${httpEndpoint}'`)

            // Register HttpFeedback
            const httpFeedback = await this.xapi.Command.HttpFeedback.Register({
                Expression: [
                    "/Event/CallDisconnect",
                    "/Event/CallSuccessful",
                    "/Status/Audio/Microphones/Mute",
                    "/Status/RoomAnalytics/PeoplePresence",
                    "/Status/RoomAnalytics/PeopleCount",
                    "/Status/SystemUnit/State/NumberOfActiveCalls",
                    "/Status/SystemUnit/State/CameraLid",
                ],
                FeedbackSlot: FEEDBACK_SLOT,
                Format: "json",
                ServerUrl: httpEndpoint,
            });
            this.console.log(`Registered HttpFeedback (slot ${httpFeedback['FeedbackSlot']}) with status ${httpFeedback['status']}`)

            const systemUnit = await this.xapi.Status.SystemUnit.get()
            this.info = {
                manufacturer: systemUnit.ProductType,
                model: systemUnit.ProductId,
                serialNumber: systemUnit.Hardware.Module.SerialNumber,
                firmware: (systemUnit.Software.Version).replace("ce", ""),
            }
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

        const roomAnalytics = await this.xapi.Status.RoomAnalytics.get()
        this.console.log(roomAnalytics)  

        this.temperature = roomAnalytics.AmbientTemperature;
        this.humidity = roomAnalytics.RelativeHumidity;
        this.occupied = (roomAnalytics.PeoplePresence === "Yes");

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
        ]
    }

    async putSetting(key: string, value: SettingValue): Promise<void> {
        this.storage.setItem(key, value.toString());
    }

    async onRequest(request: HttpRequest, response: HttpResponse) {
        response.send('OK');
        
        const json = JSON.parse(request.body)
        //this.console.log(json)

        const mute = json.Status?.Audio?.Microphones?.Mute?.Value
        if (mute) {
            this.console.log(`Mute ${mute}`)
        }

        const cameraLid = json.Status?.SystemUnit?.State?.CameraLid?.Value
        if (cameraLid) {
            this.console.log(`Camera Lid ${cameraLid}`)
        }

        const activeCalls = json.Status?.SystemUnit?.State?.NumberOfActiveCalls?.Value
        if (activeCalls) {
            this.console.log(`Active calls ${activeCalls}`)
            this.binaryState = (activeCalls !== "0")
        }

        const callConnect = json.Event?.CallSuccessful
        if (callConnect) {
            this.console.log('Call connected')
        }

        const callDisconnect = json.Event?.CallDisconnect
        if (callDisconnect) {
            this.console.log('Call disconnected')
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
