function FlagCooldowner(period)
{
    this.flag = false;
    this.period = period;
    var self = this;
    this.interval = setInterval(function ()
    {
        self.flag = false;
    },period * 1000);
}

FlagCooldowner.prototype.trigger = function ()
{
    this.flag = true;
};

FlagCooldowner.prototype.check = function ()
{
    return this.flag;
};

module.exports = FlagCooldowner;