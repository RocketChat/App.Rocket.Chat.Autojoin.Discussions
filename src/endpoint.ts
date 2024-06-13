// endpoint.ts
import { HttpStatusCode, IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { ApiEndpoint, IApiEndpointInfo, IApiRequest, IApiResponse } from '@rocket.chat/apps-engine/definition/api';

export class ForceJoinEndpoint extends ApiEndpoint {
    public path = 'forceAddUsers';

    public async post(
        request: IApiRequest,
        endpoint: IApiEndpointInfo,
        read: IRead,
        modify: IModify,
        http: IHttp,
        persis: IPersistence,
    ): Promise<IApiResponse> {
        const { content } = request;
        const { discussionId } = content;
        const discussionRoom = await read.getRoomReader().getById(discussionId);

        if (!discussionRoom) {
            return {
                status: HttpStatusCode.NOT_FOUND,
                content: `Discussion ${discussionId} could not be found`,
            };
        }

        if (!discussionRoom.parentRoom) {
            return {
                status: HttpStatusCode.BAD_REQUEST,
                content: 'Provided room does not have a parent room (not a discussion)',
            };
        }

        if(!discussionRoom.parentRoom.customFields?.autojoin?.includes(discussionRoom.id)) {
            return {
                status: HttpStatusCode.BAD_REQUEST,
                content: 'Discussion was not set as autojoin',
            };
        }

        const appUser = await read.getUserReader().getAppUser();

        if (!appUser) {
            return {
                status: HttpStatusCode.BAD_REQUEST,
                content: 'Invalid app user',
            };
        }

        const roomBuilder = await modify.getUpdater()?.room(discussionRoom.id, appUser);

        const parentRoomUsers = await read.getRoomReader().getMembers(discussionRoom.id);
        const discussionUsers = await read.getRoomReader().getMembers(discussionRoom.parentRoom.id);

        const userDif = parentRoomUsers.filter((user) => discussionUsers.findIndex((dUser) => dUser.id === user.id) < 0);

        if (userDif.length > 0) {
            roomBuilder.setMembersToBeAddedByUsernames(userDif.map((u) => u.username));
        }


        return this.success();
    }
}
