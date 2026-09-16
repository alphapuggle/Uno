#!/bin/sh
helm upgrade --install --create-namespace -n uno uno ./uno -f ./uno/values.override.yaml