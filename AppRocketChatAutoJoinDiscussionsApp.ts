import {
    IAppAccessors,
    IConfigurationExtend,
    IHttp,
    ILogger,
    IModify,
    IPersistence,
    IRead,
} from "@rocket.chat/apps-engine/definition/accessors";
import { App } from "@rocket.chat/apps-engine/definition/App";
import { IAppInfo } from "@rocket.chat/apps-engine/definition/metadata";
import {
    IPostRoomUserJoined,
    IRoomUserJoinedContext,
} from "@rocket.chat/apps-engine/definition/rooms";
import { AutoJoinCmd } from "./src/command";

export class AppRocketChatAutoJoinDiscussionsApp
    extends App
    implements IPostRoomUserJoined
{
    constructor(info: IAppInfo, logger: ILogger, accessors: IAppAccessors) {
        super(info, logger, accessors);
    }

    async executePostRoomUserJoined(
        context: IRoomUserJoinedContext,
        read: IRead,
        http: IHttp,
        persistence: IPersistence,
        modify?: IModify
    ): Promise<void> {
        if (context.room.parentRoom) {
            return;
        }

        if (
            !context.room.customFields?.autojoin ||
            !Array.isArray(context.room.customFields?.autojoin)
        ) {
            return;
        }

        const appUser = await read.getUserReader().getAppUser();

        if (!appUser) {
            return;
        }

        context.room.customFields?.autojoin.forEach(async (autojoin) => {
            if (typeof autojoin !== "string") {
                return;
            }
            const room = await read.getRoomReader().getById(autojoin);
            if (!room) {
                return;
            }

            const updater = await modify?.getUpdater();

            const roomBuilder = await updater?.room(autojoin, appUser);

            if (!roomBuilder) {
                return;
            }

            roomBuilder.addMemberToBeAddedByUsername(
                context.joiningUser.username
            );

            await updater?.finish(roomBuilder);
        });
    }

    public async extendConfiguration(configuration: IConfigurationExtend) {
        configuration.slashCommands.provideSlashCommand(new AutoJoinCmd());
    }
}
