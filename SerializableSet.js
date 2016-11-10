const fs = require('fs');

function setToJson(set)
{
    return JSON.stringify([...set]);
}
function jsonToSet(jsonStr)
{
    return new Set(JSON.parse(jsonStr));
}

function SerializableSet()
{
    this.values = new Set();
}

SerializableSet.prototype.initializeFromArray = function (array)
{
    this.values = new Set(array);
};

SerializableSet.prototype.has = function (key)
{
    return this.values.has(key);
};

SerializableSet.prototype.clear = function () {
    this.values.clear();
};

SerializableSet.prototype.showValues = function (sep) {
    if (!sep)
        sep = ',';
    var result = '';
    this.forEach(function (elem) {
       result+=elem+sep;
    });
    return result.slice(0,-sep.length);
};

SerializableSet.prototype.add = function (elem)
{
    if (this.values.has(elem))
        return true;
    this.values.add(elem);
    return false;
};


SerializableSet.prototype.delete = function (elem)
{
    this.values.delete(elem);
};

SerializableSet.prototype.size = function ()
{
    return this.values.size;
};


SerializableSet.prototype.pickRandom = function ()
{
    var n = this.size();
    var p = 1.0/n;
    var result = undefined;
    this.forEach(function (value)
    {
         var r = Math.random();
         if (r <= p)
         {
             result = value;
         }
         console.log(p);
         p/=(1-1.0/n);
     });
    if (result)
        return result;
    else
        throw new Error('pickRandom algorithm exception (might be expty set)');
};

SerializableSet.prototype.save_to_file = function (filename)
{
    fs.writeFileSync(filename,setToJson(this.values));
};

SerializableSet.prototype.load_from_file = function (filename)
{
    var storage_str = fs.readFileSync(filename);
    this.values = jsonToSet(storage_str);
};

SerializableSet.prototype.forEach = function (callback)
{
    this.values.forEach(callback);
};

module.exports = SerializableSet;