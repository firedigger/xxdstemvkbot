const fs = require('fs');

function mapToJson(map)
{
    return JSON.stringify([...map]);
}

function jsonToMap(jsonStr)
{
    return new Map(JSON.parse(jsonStr));
}

function SerializableMap()
{
    this.commands = new Map();
}

SerializableMap.prototype.initializeFromArray = function (array)
{
    this.values = new Map(array);
};

SerializableMap.prototype.add = function (key, value) {
         this.commands.set(key,value,"smthing cool");
};

SerializableMap.prototype.delete = function (key) {
    this.commands.delete(key);
};

SerializableMap.prototype.get = function (key) {
    return this.commands.get(key);
};

SerializableMap.prototype.has = function (key) {
    return this.commands.has(key);
};

SerializableMap.prototype.edit = function (key,value) {
    this.commands.delete(key);
    this.commands.set(key,value); 
};

SerializableMap.prototype.save_to_file = function (filename)
{
    fs.writeFileSync(filename,mapToJson(this.commands));
};

SerializableMap.prototype.load_from_file = function (filename)
{
    var storage_str = String(fs.readFileSync(filename));
    this.commands = jsonToMap(storage_str);
};

SerializableMap.prototype.forEach = function (callback)
{
    this.commands.forEach(callback);
};


module.exports = SerializableMap;