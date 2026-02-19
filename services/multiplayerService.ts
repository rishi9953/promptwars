import Peer, { DataConnection } from 'peerjs';

export type MultiplayerMessage =
    | { type: 'STATE_SYNC'; payload: any }
    | { type: 'ACTION'; payload: { action: string; data: any } }
    | { type: 'PLAYER_JOIN'; payload: { id: string; name: string } };

class MultiplayerManager {
    private peer: Peer | null = null;
    private connection: DataConnection | null = null;
    private isHost: boolean = false;
    private onMessageCallback: (msg: MultiplayerMessage) => void = () => { };

    init(id?: string): Promise<string> {
        return new Promise((resolve, reject) => {
            this.peer = new Peer(id, {
                debug: 2
            });

            this.peer.on('open', (id) => {
                console.log('My peer ID is: ' + id);
                resolve(id);
            });

            this.peer.on('connection', (conn) => {
                if (this.connection) {
                    conn.close();
                    return;
                }
                this.connection = conn;
                this.isHost = true;
                this.setupConnection();
            });

            this.peer.on('error', reject);
        });
    }

    join(hostId: string): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.peer) return reject('Peer not initialized');

            this.connection = this.peer.connect(hostId);
            this.isHost = false;

            this.connection.on('open', () => {
                this.setupConnection();
                resolve();
            });

            this.connection.on('error', reject);
        });
    }

    private setupConnection() {
        if (!this.connection) return;

        this.connection.on('data', (data) => {
            this.onMessageCallback(data as MultiplayerMessage);
        });

        this.connection.on('close', () => {
            console.log('Connection closed');
            this.connection = null;
        });
    }

    send(msg: MultiplayerMessage) {
        if (this.connection && this.connection.open) {
            this.connection.send(msg);
        }
    }

    onMessage(callback: (msg: MultiplayerMessage) => void) {
        this.onMessageCallback = callback;
    }

    getIsHost() { return this.isHost; }
    isConnected() { return !!this.connection && this.connection.open; }
}

export const multiplayerManager = new MultiplayerManager();
