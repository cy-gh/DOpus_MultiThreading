# DOpus_MultiThreading
Multi-threaded wrapper for user commands for Directory Opus, using Script.Vars as async communication channel.

This is only a proof of concept, so take it as it is.



To test this, create a new button as such:

**@nodeselect**
**// MultiThreadManagerStart MAXCOUNT=24 MAXWAIT=60000 COMMAND "CalcSHA256"**
**// default MAXCOUNT is the number of logical processors, i.e. hyperthreaded ones**
**// default MAXWAIT is 1 hour in milliseconds**
**MultiThreadManagerStart COMMAND="CalcSHA256"**

Basically the command which needs to be run in parallel, "CalcSHA256" in this case, must at least have a parameter called
    **RESVAR (e.g. cmd.template='RESVAR/K, ...')**
and must set it before returning, e.g.
    **Script.vars.Set(resvar) = any_JS_value_object_etc;**
and the Thread Manager and Thread Workers will take care of the rest.

The reason why RESVAR is necessary is that there is no possibility for Script Commands to directly return a value with standard JS, i.e. 'return myval;' ...that doesn't work.

And since we run basically everything via 'dopusrt /acmd' anyway, the target command "CalcSHA256" is run completely asynchronously in a thread from which we would have no possibility to receive the return value.

Now you know.



## Application areas

There are many application areas apart from just hashing. There are many excellent CLI tools which process files but are single-threaded, e.g. various .PNG optimizers, ffmpeg, wget... These can be easily converted to multi-threaded workers now. Or you could write your own server pinger, web page fetchers and run it in parallel. If **it** can be run, now **it** can be run in parallel.



## Screenshots

##### Button configuration

![./Screenshots/01.png](./Screenshots/01.png)

##### Progress window

![./Screenshots/02.png](./Screenshots/02.png)

##### Sample output

![./Screenshots/03.png](./Screenshots/03.png)