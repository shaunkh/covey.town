import AChatMessage from './AChatMessage';

// Same class as backend
export default class GlobalChatMessage extends AChatMessage {

  private _type: string;

  constructor(message: string, senderID: string) {
    super(message, senderID);
    this._type = 'global';
  }

  getType(): string {
    return this._type;
  }

  getReceiverID(): string {
    return this.senderID;
  }
  
}