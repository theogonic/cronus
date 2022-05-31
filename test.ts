import * as t from 'proto-parser';

const content = `
syntax = 'proto3';

import "wnl_core.proto";

message JwtUser {
  string id = 1;
  string email = 2 [(sdf.d)="",(abc)=""];
  string org = 3; 
}

message BaseServiceRequest {
    JwtUser invoker = 1;
}

enum AAA {
    a = 0;
}

option (zeus.gen) = {
    a: "aa"
};


message GetUserRequest {
    string userId = 1;
}

message GetUserResponse {
    option (zeus.ge) = true;
    option (zeus.gql) = {
        output: "d",
        directives:"",
        properties: {
            id: {
                type: "ID!"
            },
            favoriteActivities: {
                type : "array",
                items : {
                    type : "Activity"
                }
            }
        }
    };
    string a = 1;
}

service UserService {
    option (zeus.gen.request.extend) = {
        type: "BaseServiceRequest"
    };

    rpc GetUser(GetUserRequest) returns (GetUserResponse) {
        option (zeus.gen.rest) = {
            method: "get",
            path: "user/:id",
            decorators: ,
        };
    }
} 
`;

const protoDocument = t.parse(content) as t.ProtoDocument;
console.log(JSON.stringify(protoDocument, null, 2));

/**
{
  "imports": [
    "wnl_core.proto"
  ],
  "syntax": "proto3",
  "root": {
    "options": {
      "(abc.def).a": "aa"
    },
    "name": "",
    "fullName": "",
    "syntaxType": "ProtoRoot",
    "nested": {
      "JwtUser": {
        "name": "JwtUser",
        "fullName": ".JwtUser",
        "comment": null,
        "syntaxType": "MessageDefinition",
        "fields": {
          "id": {
            "name": "id",
            "fullName": ".JwtUser.id",
            "comment": null,
            "type": {
              "value": "string",
              "syntaxType": "BaseType"
            },
            "id": 1,
            "required": false,
            "optional": true,
            "repeated": false,
            "map": false
          },
          "email": {
            "options": {
              "(sdf.d)": "",
              "(abc)": ""
            },
            "name": "email",
            "fullName": ".JwtUser.email",
            "comment": null,
            "type": {
              "value": "string",
              "syntaxType": "BaseType"
            },
            "id": 2,
            "required": false,
            "optional": true,
            "repeated": false,
            "map": false
          },
          "org": {
            "name": "org",
            "fullName": ".JwtUser.org",
            "comment": null,
            "type": {
              "value": "string",
              "syntaxType": "BaseType"
            },
            "id": 3,
            "required": false,
            "optional": true,
            "repeated": false,
            "map": false
          }
        }
      },
      "BaseServiceRequest": {
        "name": "BaseServiceRequest",
        "fullName": ".BaseServiceRequest",
        "comment": null,
        "syntaxType": "MessageDefinition",
        "fields": {
          "invoker": {
            "name": "invoker",
            "fullName": ".BaseServiceRequest.invoker",
            "comment": null,
            "type": {
              "value": "JwtUser",
              "syntaxType": "Identifier",
              "resolvedValue": ".JwtUser"
            },
            "id": 1,
            "required": false,
            "optional": true,
            "repeated": false,
            "map": false
          }
        }
      },
      "AAA": {
        "name": "AAA",
        "fullName": ".AAA",
        "comment": null,
        "syntaxType": "EnumDefinition",
        "values": {
          "a": 0
        }
      },
      "GetUserRequest": {
        "name": "GetUserRequest",
        "fullName": ".GetUserRequest",
        "comment": null,
        "syntaxType": "MessageDefinition",
        "fields": {
          "userId": {
            "name": "userId",
            "fullName": ".GetUserRequest.userId",
            "comment": null,
            "type": {
              "value": "string",
              "syntaxType": "BaseType"
            },
            "id": 1,
            "required": false,
            "optional": true,
            "repeated": false,
            "map": false
          }
        }
      },
      "GetUserResponse": {
        "options": {
          "(zeus.ge)": true,
          "(zeus.gql).output": "d",
          "(zeus.gql).directives": "",
          "(zeus.gql).properties.id.type": "ID!",
          "(zeus.gql).properties.favoriteActivities.type": "array",
          "(zeus.gql).properties.favoriteActivities.items.type": "Activity"
        },
        "name": "GetUserResponse",
        "fullName": ".GetUserResponse",
        "comment": null,
        "syntaxType": "MessageDefinition",
        "fields": {
          "a": {
            "name": "a",
            "fullName": ".GetUserResponse.a",
            "comment": null,
            "type": {
              "value": "string",
              "syntaxType": "BaseType"
            },
            "id": 1,
            "required": false,
            "optional": true,
            "repeated": false,
            "map": false
          }
        }
      },
      "UserService": {
        "options": {
          "(zeus.gen.request.extend).type": "BaseServiceRequest"
        },
        "name": "UserService",
        "fullName": ".UserService",
        "comment": null,
        "syntaxType": "ServiceDefinition",
        "methods": {
          "GetUser": {
            "options": {
              "(zeus.gen.rest).method": "get",
              "(zeus.gen.rest).path": "user/:id"
            },
            "name": "GetUser",
            "fullName": ".UserService.GetUser",
            "comment": null,
            "requestType": {
              "value": "GetUserRequest",
              "syntaxType": "Identifier",
              "resolvedValue": ".GetUserRequest"
            },
            "responseType": {
              "value": "GetUserResponse",
              "syntaxType": "Identifier",
              "resolvedValue": ".GetUserResponse"
            }
          }
        }
      }
    }
  },
  "syntaxType": "ProtoDocument"
}



 */
