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
    }
}