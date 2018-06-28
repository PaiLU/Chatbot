"use strict"

module.exports = {
    leaveTypeDisplayConvert: function (t) {
        return t.split('').map(function (value, index, array) {
            var temp = value.charCodeAt(0).toString(16).toUpperCase();
            return '&#x' + temp + ";";
            return value;
        }).join('');
    },
    checkEntity: function (string, list) {
        var check = false;
        for (var a in list) {
            if (string && string.toString().toLowerCase() == list[a].toString().toLowerCase()) {
                check = list[a].toString();
                break;
            }
        }
        return check;
    },
    entityExtract: function entityExtract(receivedEntity) {
        var o = new Object();
        if (receivedEntity && receivedEntity.resolution.values) {
            return receivedEntity.resolution.values[0].toLowerCase();
        } else
            return null;
    }
}