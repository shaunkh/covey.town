import ICensorer from "./ICensorer";
import RegExp from "typescript-dotnet-commonjs/System/Text/RegularExpressions";

export default class Censorer implements ICensorer {

    private static _instance: Censorer;

    static getInstance(): Censorer {
        if (Censorer._instance === undefined) {
          Censorer._instance = new Censorer();
        }
        return Censorer._instance;
      }

    censorMessage(incomingMessage: string): string {
        console.log(incomingMessage);
        throw new Error("Method not implemented.");
    }


}