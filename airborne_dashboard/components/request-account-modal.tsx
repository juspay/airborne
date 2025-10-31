"use client";

import type React from "react";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogDescription, DialogTitle } from "./ui/dialog";
import { useForm } from "react-hook-form";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { apiFetch } from "@/lib/api";

type FormValues = {
  name: string;
  email: string;
};

interface RequestAccountModalProps {
  onSubmit: () => void;
}

export const RequestAccountModal: React.FC<RequestAccountModalProps> = ({ onSubmit }) => {
  const [submitted, setSubmitted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const form = useForm<FormValues>({
    defaultValues: {
      name: "",
      email: "",
    },
  });

  const isLoading = form.formState.isSubmitting;

  const handleSubmit = async (values: FormValues) => {
    try {
      await apiFetch("/users/request-account", {
        method: "POST",
        body: values,
      });

      setSubmitted(true);
      form.reset();
      setTimeout(() => {
        setIsOpen(false);
        setSubmitted(false);
      }, 3000);
      onSubmit();
    } catch (error) {
      console.error("Error submitting request:", error);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={() => {
        setIsOpen(!isOpen);
        setSubmitted(false);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary" className="whitespace-nowrap">
          Request Account
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request an Account</DialogTitle>
          <DialogDescription>Please fill out the form below to request an account.</DialogDescription>
        </DialogHeader>
        <div>
          {submitted ? (
            <div className="text-center text-green-600 font-medium">
              Thank you for your request! We will get back to you soon.
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  rules={{ required: "Full name is required" }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter your full name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  rules={{
                    required: "Email address is required",
                    pattern: {
                      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                      message: "Please enter a valid email",
                    },
                  }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="Enter your email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end">
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? "Submitting..." : "Submit Request"}
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
