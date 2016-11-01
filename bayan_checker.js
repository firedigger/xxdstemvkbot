const fs = require('fs');

function setToJson(set)
{
    return JSON.stringify([...set]);
}
function jsonToSet(jsonStr)
{
    return new Set(JSON.parse(jsonStr));
}

function hashFnv32a(str, asString, seed)
{

    var i, l,
        hval = (seed === undefined) ? 0x811c9dc5 : seed;

    for (i = 0, l = str.length; i < l; i++) {
        hval ^= str.charCodeAt(i);
        hval += (hval << 1) + (hval << 4) + (hval << 7) + (hval << 8) + (hval << 24);
    }
    if( asString ){
        // Convert to 8 digit hex string
        return ("0000000" + (hval >>> 0).toString(16)).substr(-8);
    }
    return hval >>> 0;
    //return str;
}

function Bayan_checker()
{
    this.values = new Set();
}

Bayan_checker.prototype.add_and_check = function (value)
{
    var hashed = hashFnv32a(value);
    var flag = this.values.has(hashed);

    if (!flag)
    {
        this.values.add(hashed);
    }

    return flag;
};


Bayan_checker.prototype.save_to_file = function (filename)
{
    fs.writeFileSync(filename,setToJson(this.values));
};

Bayan_checker.prototype.load_from_file = function (filename)
{
    var storage_str = fs.readFileSync(filename);
    this.values = jsonToSet(storage_str);
};

Bayan_checker.prototype.forEach = function (callback)
{
    this.values.forEach(callback);
};

module.exports = Bayan_checker;