import {
    IHttp,
    IModify,
    IPersistence,
    IRead,
} from "@rocket.chat/apps-engine/definition/accessors";
import { IRoom } from "@rocket.chat/apps-engine/definition/rooms";
import {
    ISlashCommand,
    SlashCommandContext,
} from "@rocket.chat/apps-engine/definition/slashcommands";
import { IUser } from "@rocket.chat/apps-engine/definition/users";

export class AutoJoinCmd implements ISlashCommand {
    public command = "autojoin";
    public i18nParamsExample: string = "status_update_command_params_example";
    public i18nDescription: string = "status_update_command_description";
    public providesPreview: boolean = false;

    public async executor(
        context: SlashCommandContext,
        read: IRead,
        modify: IModify,
        http: IHttp,
        persis: IPersistence
    ): Promise<void> {
        const user = context.getSender();
        const params = context.getArguments();
        const room = context.getRoom();

        if (!room.parentRoom) {
            return;
        }

        const updater = await modify.getUpdater();

        const appUser = await read.getUserReader().getAppUser();

        if (!appUser) {
            return;
        }

        const roomBuilder = await updater?.room(room.parentRoom.id, appUser);

        if (!roomBuilder) {
            return;
        }

        const autojoin = new Set(room.parentRoom.customFields?.autojoin ?? []);

        autojoin.add(room.id);

        roomBuilder.setCustomFields({
            autojoin: [...autojoin],
        });

        await updater?.finish(roomBuilder);

        return this.notifyMessage(
            room,
            read,
            user,
            "Autojoin enabled for room " + room.displayName
        );
    }

    private async notifyMessage(
        room: IRoom,
        read: IRead,
        sender: IUser,
        message: string
    ): Promise<void> {
        const notifier = read.getNotifier();
        const messageBuilder = notifier.getMessageBuilder();
        messageBuilder.setText(message);
        messageBuilder.setRoom(room);
        return notifier.notifyUser(sender, messageBuilder.getMessage());
    }
}
