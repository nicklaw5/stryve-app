import store from '../vuex/store'
import io from 'socket.io-client'
import * as token from './token'
import * as helpers from './helpers'
import { setServerSocketId } from '../vuex/users/actions'
import { pushEventToChannel, instantiateServerChannels } from '../vuex/servers/actions'

export const connectToServerSocket = (state, server) =>  {
	// connect to the socket if the user hasn't already
	if(helpers.isEmptyObject(window.serverSocket)) {
		window.serverSocket = io(server.server_uri + 'servers', {forceNew: true})
		// console.log(window.serverSocket);

		// update title
		helpers.updateTitleText(server.name)

		// ON CONNECTION TO SERVER
		window.serverSocket.on('connected', socket_id => {
			// set the users unique socket_id
			setServerSocketId(store, window.serverSocket.id)

			// send user and socket data back to server for logging
			submitUserConnectedEvent(state, store._vm.users.user)
		})

		// ON USER CONNECTED EVENT
		window.serverSocket.on('user-connected', payload => {
			// TODO - set online status maybe??
			// console.log(payload)
		})

		// ON USER DISCONNECTED EVENT
		window.serverSocket.on('user-disconnected', payload => {
			// TODO
			// console.log(payload)
		})

		// ON CHANNEL CREATION
		window.serverSocket.on('channel-created', channel => {
			instantiateServerChannels(store, store._vm.servers.currentServer, [channel])
			helpers.notification('New Channel Created', { body: channel.name + ' has been created.' })
		})

	// else if, check that the server hasn't changed
	// if it has we need to disconnect first
	// then reconnect to the new uri
	} else if(window.serverSocket.io.uri != server.server_uri) {

		console.log('disconnecting from ' + window.serverSocket.io.uri)
		disconnectFromServerSocket()

		// reset the socket
		window.serverSocket = {}

		// connect to the new server
		console.log('connecting to ' + server.server_uri)
		connectToSocketServer(store, server)

	// else, use current socket connection
	} else {
		// do nothing, we're already connected to the correct server
		console.log('already connected to this server')
	}
}

export const listenOnChannel = (state, channel_uuid) => {
	
	// ON USER JOINED CHANNEL
	window.serverSocket.on('user-subscribed-to::' + channel_uuid, payload => {
		// add event to channel
		pushEventToChannel(store, payload, false)

		// notify the user of new user subscription
		helpers.notification(payload.event_text, {})
	})

	// ON USER LEFT CHANNEL
	window.serverSocket.on('user-unsubscribed-from::' + channel_uuid, payload => {
		pushEventToChannel(store, payload, false)
	})

	// ON PRELIMINARY MESSAGE RECEIVED TO CHANNEL
	window.serverSocket.on('channel-message::' + channel_uuid + '::preliminary', payload => {
		pushEventToChannel(store, payload, true)
	})

	// ON MESSAGE RECEIVED TO CHANNEL
	window.serverSocket.on('channel-message::' + channel_uuid, payload => {
		pushEventToChannel(store, payload, false)
	})
}

export const disconnectFromServerSocket = () => {
	if(!helpers.isEmptyObject(window.serverSocket)) {
		window.serverSocket.disconnect()
		window.serverSocket = {}
	}
}

export const submitUserConnectedEvent = (state, user) => {
	// check we have a server set
	if(helpers.isNullOrUndefined(state.servers[state.currentServer]))
		return

	// send the message to all connected sockets
	window.serverSocket.emit('user-connected', {
		server_uuid: 		state.currentServer,
		server_name: 		state.servers[state.currentServer].name,
		owner_uuid:			user.uuid,
		owner_username:		user.username,
		access_token: 		token.get()
	})
}

export const subscribeToChannel = (channel, user) => {
	if(!helpers.isEmptyObject(channel)) {
		window.serverSocket.emit("subscribe-to-channel", {
			channel_uuid: 	channel.uuid,
			channel_name: 	channel.name,
			owner_uuid: 	user.uuid,
			owner_username: user.username,
		})
	}
}

export const unsubscribeFromChatChannel = (channel, user) => {
	if(!helpers.isEmptyObject(channel)) {
		window.serverSocket.emit("unsubscribe-from-channel", { 
			channel_uuid: 	channel.uuid,
			channel_name: 	channel.name,
			owner_uuid: 	user.uuid,
			owner_username: user.username,
		})
	}
}

export const sendChannelMessage = (text, channel_uuid, user) => {
	window.serverSocket.emit('channel-message', {
		channel_uuid: 	channel_uuid,
		owner_uuid:		user.uuid,
		owner_username:	user.username,
		event_text:		text,
		access_token: 	token.get()
	})
}

export const sendChannelCreated = (channel) => {
	window.serverSocket.emit('channel-created', channel)
}
