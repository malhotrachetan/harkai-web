#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""
import os
import sys
from encrypted_secrets import load_secrets, YAMLFormatException


def main(): 
    """Run administrative tasks."""
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "harkaibackend.settings")
    try:
        load_secrets()
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    except YAMLFormatException:
        print("\n\n\nMALFORMED YAML IN ENCRYPTED SECRETS\n\n\n")
    execute_from_command_line(sys.argv)
    


if __name__ == "__main__":
    main()
