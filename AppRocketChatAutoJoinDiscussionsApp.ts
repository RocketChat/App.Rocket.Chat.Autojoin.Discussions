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
    IPostRoomUserLeave,
    IRoomUserJoinedContext,
    IRoomUserLeaveContext,
} from "@rocket.chat/apps-engine/definition/rooms";
import { AutoJoinCmd } from "./src/command";
import { ApiSecurity, ApiVisibility } from "@rocket.chat/apps-engine/definition/api";
import { ForceJoinEndpoint } from './src/endpoint';

export class AppRocketChatAutoJoinDiscussionsApp
    extends App
    implements IPostRoomUserJoined, IPostRoomUserLeave
{
    constructor(info: IAppInfo, logger: ILogger, accessors: IAppAccessors) {
        super(info, logger, accessors);
    }

    async executePostRoomUserLeave(context: IRoomUserLeaveContext, read: IRead, http: IHttp, persistence: IPersistence, modify?: IModify | undefined): Promise<void> {
        const { room, leavingUser } = context;

        if (room.parentRoom) {
            return;
        }

        const discussions = room.customFields?.autojoin;
        if (!discussions || !Array.isArray(discussions)) {
            return;
        }

        const deleter = modify?.getDeleter();
        if (!deleter) {
            return;
        }

        for await (const discussionId of discussions) {
            deleter.removeUsersFromRoom(discussionId, [leavingUser.username]);
        }
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

        // Register API endpoints
        await configuration.api.provideApi({
            visibility: ApiVisibility.PUBLIC,
            security: ApiSecurity.UNSECURE,
            endpoints: [new ForceJoinEndpoint(this)],
        });
    }
}
